/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import type { IMetricsService } from '../../../../common/metricsService.js';
import type {
	AnalysisOptions,
	AnalysisProfile,
	FunctionalEdge,
	FunctionalNode,
	ProjectOsAnalyzeLlmConfig,
	ProjectType,
} from '../../../../common/projectOsTypes.js';
import type { ScannedFile } from '../analyzer/file-scanner.js';
import type { RouteEntry } from '../../../../common/projectOsTypes.js';
import { discoverEntries } from '../analyzer/entry-discovery.js';
import { buildProjectOutline } from '../analyzer/symbol-outline.js';
import { validateAnchors } from './anchor-validator.js';
import { generateAiNodeId, slugify } from './node-id.js';
import {
	requestFunctionTreePass1,
	type LlmFunctionTreeNode,
	type LlmFunctionTreeResponse,
} from '../llm/llm-function-tree-pass1.js';
import { requestFunctionTreePass2 } from '../llm/llm-function-tree-pass2.js';
import { buildEntryDrivenTree, supplementWithEntryDriven } from '../llm/entry-driven-tree.js';
import { filterDirectoryMirrorNodes, hasMinimumProductTree } from '../llm/llm-tree-quality.js';
import { isLocalLlmProvider, pass2FeatureLimit } from '../llm/llm-timeouts.js';

export interface FunctionTreeBuildResult {
	nodes: FunctionalNode[]
	edges: FunctionalEdge[]
	entryCount: number
	pipeline: 'entry_driven' | 'ai_pass1' | 'ai_pass2'
}

function mapLlmNodeToFunctional(
	raw: LlmFunctionTreeNode,
	parentId: string | null,
	slugToId: Map<string, string>,
	projectPath: string,
): Promise<FunctionalNode> {
	const primaryAnchor = raw.anchors[0];
	const id = generateAiNodeId(raw.slug, parentId, primaryAnchor);
	slugToId.set(raw.slug, id);

	return validateAnchors(projectPath, raw.anchors ?? []).then(({ valid, linkedFiles }) => ({
		id,
		type: 'capability' as const,
		name: raw.name,
		nameEn: raw.nameEn,
		status: 'active' as const,
		description: raw.description,
		summary: raw.summary,
		parentId,
		children: [],
		refs: [],
		depth: parentId === null || parentId === 'sys_root' ? 1 : 0,
		linkedFiles: linkedFiles.length > 0 ? linkedFiles : valid.map(a => ({
			path: a.path,
			role: a.role,
			summary: a.summary,
		})),
		anchors: valid,
		granularity: raw.granularity,
		lineage: {
			slug: slugify(raw.slug),
			aliases: [],
			createdBy: 'ai' as const,
			createdAt: new Date().toISOString(),
		},
		crossRefs: [],
		upstream: [],
		downstream: [],
		preview: null,
		confidence: 0.75,
		tags: raw.tags ?? [],
	}));
}

function buildEdgesFromLlm(
	edges: LlmFunctionTreeResponse['edges'],
	slugToId: Map<string, string>,
): FunctionalEdge[] {
	const result: FunctionalEdge[] = [];
	for (const e of edges ?? []) {
		const source = slugToId.get(e.sourceSlug);
		const target = slugToId.get(e.targetSlug);
		if (!source || !target || source === target) {
			continue;
		}
		if (e.relation === 'imports') {
			continue;
		}
		result.push({
			id: `ai_${source}_${target}_${e.relation}`,
			source,
			target,
			relation: e.relation,
			confidence: e.confidence ?? 0.7,
			evidence: e.evidence ?? 'AI inferred',
		});
	}
	return result;
}

function attachParentChild(nodes: FunctionalNode[]): FunctionalNode[] {
	const byId = new Map(nodes.map(n => [n.id, { ...n, children: [] as string[] }]));
	for (const node of byId.values()) {
		if (node.parentId && byId.has(node.parentId)) {
			const parent = byId.get(node.parentId)!;
			if (!parent.children.includes(node.id)) {
				parent.children.push(node.id);
			}
		}
	}
	const rootId = 'sys_root';
	function setDepth(id: string, depth: number, visiting = new Set<string>()) {
		if (visiting.has(id)) {
			return;
		}
		visiting.add(id);
		const n = byId.get(id);
		if (!n) {
			return;
		}
		n.depth = depth;
		for (const cid of n.children) {
			setDepth(cid, depth + 1, visiting);
		}
	}
	for (const n of byId.values()) {
		if (n.parentId === rootId || (n.parentId === null && n.id !== rootId)) {
			setDepth(n.id, n.parentId === rootId ? 1 : n.depth || 1);
		}
	}
	return Array.from(byId.values());
}

async function llmNodesToFunctional(
	rawNodes: LlmFunctionTreeNode[],
	input: {
		projectPath: string
		parentNode?: FunctionalNode
		staticNodes?: FunctionalNode[]
	},
): Promise<{ nodes: FunctionalNode[]; slugToId: Map<string, string> }> {
	const slugToId = new Map<string, string>();
	if (input.parentNode) {
		slugToId.set(input.parentNode.lineage?.slug ?? slugify(input.parentNode.name), input.parentNode.id);
	}

	const functionalNodes: FunctionalNode[] = [];
	for (const raw of rawNodes) {
		let parentId: string | null;
		if (raw.parentSlug) {
			parentId = slugToId.get(raw.parentSlug) ?? input.parentNode?.id ?? 'sys_root';
		} else {
			parentId = input.parentNode?.id ?? 'sys_root';
		}
		const node = await mapLlmNodeToFunctional(raw, parentId, slugToId, input.projectPath);
		if (input.staticNodes) {
			const hint = input.staticNodes.find(s => slugify(s.name) === slugify(raw.name));
			if (hint) {
				node.sourceClusterIds = [hint.id];
			}
		}
		functionalNodes.push(node);
	}
	return { nodes: functionalNodes, slugToId };
}

function fileExcerpt(files: ScannedFile[], paths: (string | undefined)[], maxLines = 30): { path: string; excerpt: string; exports?: string[] }[] {
	const pathSet = new Set(paths.filter((p): p is string => typeof p === 'string' && !!p).map(p => p.replace(/\\/g, '/')));
	return files
		.filter(f => pathSet.has(f.relativePath.replace(/\\/g, '/')))
		.slice(0, 15)
		.map(f => ({
			path: f.relativePath.replace(/\\/g, '/'),
			excerpt: (f.content ?? '').split('\n').slice(0, maxLines).join('\n'),
			exports: f.content ? (f.content.match(/export\s+(?:async\s+)?(?:function|const|class)\s+(\w+)/g) ?? []).slice(0, 8) : undefined,
		}));
}

function outlineForPaths(outline: object[], paths: (string | undefined)[]): object[] {
	const pathSet = new Set(paths.filter((p): p is string => typeof p === 'string' && !!p).map(p => p.replace(/\\/g, '/')));
	return outline.filter((o: any) => pathSet.has(String(o.path ?? o.file ?? '').replace(/\\/g, '/')));
}

/** Multi-stage AI function tree: Pass1 coarse tree + optional Pass2 per-feature refine (deep). */
export async function buildFunctionTree(input: {
	projectPath: string
	projectName: string
	projectType: ProjectType
	profile: AnalysisProfile
	files: ScannedFile[]
	routes: RouteEntry[]
	staticNodes?: FunctionalNode[]
	parentNode?: FunctionalNode
	packageJson?: { description?: string; name?: string } | null
	llm: ProjectOsAnalyzeLlmConfig
	metricsService: IMetricsService
	options?: AnalysisOptions
	onStage?: (stage: 'entry_discovery' | 'ai_pass1' | 'ai_pass2', message: string) => void
}): Promise<FunctionTreeBuildResult> {
	const outline = buildProjectOutline(input.files);
	const routeHints = input.routes.map(r => ({ path: r.urlPath, file: r.filePath }));

	input.onStage?.('entry_discovery', '发现产品入口…');
	const discovery = discoverEntries({
		projectType: input.projectType,
		files: input.files,
		routes: input.routes,
		packageJson: input.packageJson,
	});

	input.onStage?.('ai_pass1', 'AI 粗粒度功能树…');
	const isLocal = isLocalLlmProvider(input.llm.modelSelection.providerName);
	let allRawNodes: LlmFunctionTreeNode[];
	let pass1Edges: LlmFunctionTreeResponse['edges'];
	let pipeline: FunctionTreeBuildResult['pipeline'] = 'ai_pass1';

	try {
		const pass1 = await requestFunctionTreePass1({
			projectName: input.projectName,
			projectType: input.projectType,
			profile: input.profile,
			entryPoints: discovery.entries,
			readmeExcerpt: discovery.readmeExcerpt,
			packageDescription: discovery.packageDescription,
			productFeatures: discovery.productFeatures,
			routes: routeHints,
			outlineSample: outline,
			llm: input.llm,
			metricsService: input.metricsService,
			compactPayload: isLocal,
		});
		pass1Edges = pass1.edges;
		allRawNodes = filterDirectoryMirrorNodes(supplementWithEntryDriven(pass1.nodes, discovery, input.projectName));
	} catch (pass1Err) {
		input.onStage?.('ai_pass1', 'Pass1 超时/失败，使用入口驱动功能树…');
		allRawNodes = filterDirectoryMirrorNodes(buildEntryDrivenTree(discovery, input.projectName));
		pass1Edges = undefined;
		pipeline = 'entry_driven';
		if (allRawNodes.length === 0) {
			throw pass1Err;
		}
	}

	const pass2Limit = pass2FeatureLimit(input.profile, isLocal);

	if (pass2Limit > 0 && !input.parentNode) {
		const topFeatures = allRawNodes
			.filter(n => !n.parentSlug && (n.granularity === 'feature' || n.granularity === 'module'))
			.slice(0, pass2Limit);
		const maxPerFeature = input.options?.maxUnitNodesPerFeature ?? 20;

		for (const feature of topFeatures) {
			input.onStage?.('ai_pass2', `细化功能: ${feature.name}…`);
			const linkedPaths = [
				...feature.anchors.map(a => a.path),
				...(discovery.entries.find(e => e.label.includes(feature.name) || feature.name.includes(e.label))?.files ?? []),
			];
			try {
				const pass2Nodes = await requestFunctionTreePass2({
					parentSlug: feature.slug,
					parentName: feature.name,
					linkedFilesSummary: fileExcerpt(input.files, linkedPaths),
					outlineForFeature: outlineForPaths(outline, linkedPaths),
					maxNodes: maxPerFeature,
					llm: input.llm,
					metricsService: input.metricsService,
				});
				allRawNodes.push(...filterDirectoryMirrorNodes(pass2Nodes));
				pipeline = 'ai_pass2';
			} catch {
				// Pass2 optional per feature — keep Pass1 / entry-driven nodes
			}
		}
	}

	if (!hasMinimumProductTree(allRawNodes, 6, 2)) {
		allRawNodes = supplementWithEntryDriven(allRawNodes, discovery, input.projectName);
	}

	const { nodes: functionalNodes, slugToId } = await llmNodesToFunctional(allRawNodes, {
		projectPath: input.projectPath,
		parentNode: input.parentNode,
		staticNodes: input.staticNodes,
	});

	const withHierarchy = attachParentChild(functionalNodes);
	const edges = buildEdgesFromLlm(pass1Edges, slugToId);

	const crossRefsByNode = new Map<string, Set<string>>();
	for (const e of edges) {
		const src = withHierarchy.find(n => n.id === e.source);
		const tgt = withHierarchy.find(n => n.id === e.target);
		if (!src || !tgt) {
			continue;
		}
		if (src.parentId !== tgt.parentId) {
			const sSet = crossRefsByNode.get(e.source) ?? new Set();
			sSet.add(e.target);
			crossRefsByNode.set(e.source, sSet);
			const tSet = crossRefsByNode.get(e.target) ?? new Set();
			tSet.add(e.source);
			crossRefsByNode.set(e.target, tSet);
		}
	}

	return {
		nodes: withHierarchy.map(n => ({
			...n,
			crossRefs: Array.from(crossRefsByNode.get(n.id) ?? []),
		})),
		edges,
		entryCount: discovery.entries.length,
		pipeline,
	};
}

/** Pass2 lazy refinement for a single parent node (standard expand). */
export async function expandFeatureWithPass2(input: {
	projectPath: string
	projectName: string
	projectType: ProjectType
	parentNode: FunctionalNode
	files: ScannedFile[]
	routes: RouteEntry[]
	llm: ProjectOsAnalyzeLlmConfig
	metricsService: IMetricsService
	maxUnitNodes?: number
}): Promise<{ nodes: FunctionalNode[]; edges: FunctionalEdge[] }> {
	const outline = buildProjectOutline(input.files);
	const parentSlug = input.parentNode.lineage?.slug ?? slugify(input.parentNode.name);
	const linkedPaths = [
		...input.parentNode.linkedFiles.map(f => f.path),
		...(input.parentNode.anchors ?? []).map(a => a.path),
	];

	const pass2Nodes = await requestFunctionTreePass2({
		parentSlug,
		parentName: input.parentNode.name,
		linkedFilesSummary: fileExcerpt(input.files, linkedPaths),
		outlineForFeature: outlineForPaths(outline, linkedPaths),
		maxNodes: input.maxUnitNodes ?? 20,
		llm: input.llm,
		metricsService: input.metricsService,
	});

	const { nodes: functionalNodes } = await llmNodesToFunctional(pass2Nodes, {
		projectPath: input.projectPath,
		parentNode: input.parentNode,
	});

	const withHierarchy = attachParentChild(functionalNodes);
	const children = withHierarchy.filter(n => n.parentId === input.parentNode.id);

	return {
		nodes: children,
		edges: [],
	};
}
