/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as fs from 'fs/promises';
import * as path from 'path';
import { IServerChannel } from '../../../../base/parts/ipc/common/ipc.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { analyzeProject } from './projectOs/engine/graph/builder.js';
import { enrichTopology, computeTopologyMeta } from './projectOs/engine/graph/topology-hierarchy.js';
import { expandSubmoduleNodes } from './projectOs/engine/graph/submodule-expansion.js';
import { migrateGraph } from './projectOs/engine/graph/graph-migrate.js';
import { expandNodeWithAi } from './projectOs/engine/graph/ai-function-tree.js';
import { readChangelog, exportChangelogText } from './projectOs/engine/graph/graph-changelog.js';
import { applyGraphEdit, localValidateEdit, shouldBlockEdit, persistGraphEdit } from './projectOs/engine/graph/graph-edit.js';
import { validateEditWithLlm, refineNodeWithLlm } from './projectOs/engine/llm/llm-architecture-guard.js';
import { resolveNodeId } from './projectOs/engine/graph/node-id.js';
import { renderTopologyMarkdown } from './projectOs/engine/graph/topology-render.js';
import { FileMemoryStore } from './projectOs/engine/memory/memory-store.js';
import { createJob, updateJob, completeJob, failJob } from './projectOs/engine/jobs/index.js';
import {
	scanFiles,
	readPackageJson,
	detectRoutes,
	detectProjectType,
} from './projectOs/engine/analyzer/index.js';
import {
	buildNodeContext,
	buildProjectContext,
	getNodeStageFilePaths,
	renderNodeContextMarkdown,
	renderProjectContextMarkdown,
	extractFileSnippet,
	getNodeAnchorSnippetTargets,
} from './projectOs/engine/context/index.js';
import type {
	AnalysisOptions,
	AnalysisProgress,
	ApplyGraphEditResponse,
	ArchitectureGuardMode,
	BuildContextResponse,
	GraphChangelogEntry,
	GraphEdit,
	GraphResponse,
	NodeContext,
	NodeDetailResponse,
	ProjectContext,
	ProjectDetailResponse,
	ProjectGraph,
	ProjectOsAnalyzeLlmConfig,
	RefineNodeResponse,
	SelectNodeContextResponse,
	SubmitPromptResponse,
	ValidateEditResponse,
} from '../common/projectOsTypes.js';
import { DEFAULT_ANALYSIS_OPTIONS } from '../common/projectOsTypes.js';
import { IMetricsService } from '../common/metricsService.js';

export class ProjectOsChannel implements IServerChannel {

	private readonly graphs = new Map<string, ProjectGraph>();
	private readonly projectPaths = new Map<string, string>();
	private readonly pendingReanalyze = new Map<string, ReturnType<typeof setTimeout>>();
	private memoryStore: FileMemoryStore | null = null;

	constructor(
		private readonly metricsService: IMetricsService,
	) { }

	private readonly progressEmitter = new Emitter<AnalysisProgress>();
	private readonly completeEmitter = new Emitter<{ jobId: string; projectId: string }>();
	private readonly errorEmitter = new Emitter<{ jobId: string; code: string; message: string }>();

	listen(_: unknown, event: string): Event<any> {
		if (event === 'onProgress') {
			return this.progressEmitter.event;
		}
		if (event === 'onComplete') {
			return this.completeEmitter.event;
		}
		if (event === 'onError') {
			return this.errorEmitter.event;
		}
		throw new Error(`ProjectOsChannel event not found: ${event}`);
	}

	async call(_: unknown, command: string, params: any): Promise<any> {
		switch (command) {
			case 'analyze':
				return this.analyze(params.projectPath, params.jobId, params.llm, params.options);
			case 'scheduleReanalyze':
				return this.scheduleReanalyze(params.projectPath, params.jobId, params.llm, params.options);
			case 'getGraph':
				return this.getGraph(params.projectId);
			case 'getNodeDetail':
				return this.getNodeDetail(params.projectId, params.nodeId);
			case 'getProjectDetail':
				return this.getProjectDetail(params.projectId);
			case 'buildNodeContext':
				return this.buildNodeContext(params.projectId, params.nodeId);
			case 'buildProjectContext':
				return this.buildProjectContext(params.projectId);
			case 'tryLoadFromWorkspace':
				return this.tryLoadFromWorkspace(params.projectPath);
			case 'getChatContextPack':
				return this.getChatContextPack(params.projectId, params.nodeId ?? null);
			case 'buildContext':
				return this.buildContext(params.projectId, params.nodeId ?? null);
			case 'selectNodeContext':
				return this.selectNodeContext(params.projectId, params.nodeId);
			case 'selectProjectContext':
				return this.selectProjectContext(params.projectId);
			case 'submitPrompt':
				return this.submitPrompt(params.projectId, params.nodeId, params.text);
			case 'getTopologyMarkdown':
				return this.getTopologyMarkdown(params.projectId, params.focusNodeId);
			case 'expandNodeAnalysis':
				return this.expandNodeAnalysis(params.projectId, params.nodeId, params.llm);
			case 'refineNode':
				return this.refineNode(params.projectId, params.nodeId, params.llm);
			case 'validateEdit':
				return this.validateEdit(params.projectId, params.edit, params.llm, params.guardMode);
			case 'applyGraphEdit':
				return this.applyGraphEdit(params.projectId, params.edit, params.force, params.llm, params.guardMode);
			case 'getChangelog':
				return this.getChangelog(params.projectId, params.nodeId);
			case 'exportChangelog':
				return this.exportChangelog(params.projectId);
			case 'resolveNodeId':
				return this.resolveNodeId(params.projectId, params.nodeIdOrAlias);
			default:
				throw new Error(`ProjectOsChannel command not found: ${command}`);
		}
	}

	private runAnalysis(
		projectPath: string,
		jobId: string,
		llm?: ProjectOsAnalyzeLlmConfig,
		options?: AnalysisOptions,
	): void {
		createJob(jobId);

		analyzeProject(projectPath, jobId, {
			onProgress: (progress: AnalysisProgress) => {
				updateJob(jobId, {
					status: 'analyzing',
					progress: progress.percent,
					stage: progress.stage,
				});
				this.progressEmitter.fire(progress);
			},
			onComplete: async (graph: ProjectGraph) => {
				this.graphs.set(graph.projectId, graph);
				this.projectPaths.set(graph.projectId, projectPath);
				const memPath = path.join(projectPath, '.projectos', 'memory.json');
				this.memoryStore = new FileMemoryStore(memPath);
				await this.memoryStore.load();
				const topologyMd = renderTopologyMarkdown(graph, { includeFiles: true });
				await this.memoryStore.upsert(
					'architecture-topology',
					topologyMd,
					'project',
					null,
				);
				completeJob(jobId);
				this.completeEmitter.fire({ jobId, projectId: graph.projectId });
			},
			onError: (error: Error) => {
				failJob(jobId, error.message);
				this.errorEmitter.fire({
					jobId,
					code: 'ANALYSIS_FAILED',
					message: error.message,
				});
			},
		}, {
			llm,
			metricsService: llm ? this.metricsService : undefined,
			analysisOptions: { ...DEFAULT_ANALYSIS_OPTIONS, ...options },
		});
	}

	private async analyze(projectPath: string, jobId: string, llm?: ProjectOsAnalyzeLlmConfig, options?: AnalysisOptions): Promise<{ success: boolean; jobId: string }> {
		this.runAnalysis(projectPath, jobId, llm, options);
		return { success: true, jobId };
	}

	private scheduleReanalyze(projectPath: string, jobId: string, llm?: ProjectOsAnalyzeLlmConfig, options?: AnalysisOptions): { scheduled: boolean } {
		const existing = this.pendingReanalyze.get(projectPath);
		if (existing) {
			clearTimeout(existing);
		}
		const timeout = setTimeout(() => {
			this.pendingReanalyze.delete(projectPath);
			this.runAnalysis(projectPath, jobId, llm, options);
		}, 8000);
		this.pendingReanalyze.set(projectPath, timeout);
		return { scheduled: true };
	}

	private getGraph(projectId: string): GraphResponse | null {
		const graph = this.graphs.get(projectId);
		if (!graph) {
			return null;
		}
		const projectPath = this.projectPaths.get(projectId) ?? '';
		return this.graphResponse(graph, projectPath);
	}

	private extractRoutesAndApis(node: ProjectGraph['nodes'][0]): { routes: string[]; apis: string[] } {
		const routes = new Set<string>();
		const apis = new Set<string>();
		if (node.preview?.route) {
			routes.add(node.preview.route);
		}
		for (const f of node.linkedFiles) {
			const p = f.path.replace(/\\/g, '/');
			if (f.role === 'api' || p.includes('/api/')) {
				const m = p.match(/app\/api\/(.+?)\/route\./);
				if (m) {
					apis.add(`/api/${m[1]}`);
				}
			}
		}
		return { routes: Array.from(routes), apis: Array.from(apis) };
	}

	private getNodeDetail(projectId: string, nodeId: string): NodeDetailResponse | null {
		const graph = this.graphs.get(projectId);
		if (!graph) {
			return null;
		}
		const node = graph.nodes.find(n => n.id === nodeId);
		if (!node) {
			return null;
		}
		const { routes, apis } = this.extractRoutesAndApis(node);
		return {
			id: node.id,
			name: node.name,
			nameEn: node.nameEn,
			status: node.status,
			description: node.description,
			summary: node.summary,
			files: node.linkedFiles,
			anchors: node.anchors,
			granularity: node.granularity,
			lineage: node.lineage,
			crossRefs: node.crossRefs,
			upstream: node.upstream
				.map(id => graph.nodes.find(n => n.id === id))
				.filter(Boolean)
				.map(n => ({ id: n!.id, name: n!.name })),
			downstream: node.downstream
				.map(id => graph.nodes.find(n => n.id === id))
				.filter(Boolean)
				.map(n => ({ id: n!.id, name: n!.name })),
			preview: node.preview,
			tags: node.tags,
			routes,
			apis,
		};
	}

	private getProjectDetail(projectId: string): ProjectDetailResponse | null {
		const graph = this.graphs.get(projectId);
		if (!graph) {
			return null;
		}
		const featureNodes = graph.nodes.filter(n => n.id !== 'sys_root');
		const ctx = buildProjectContext(graph);
		return {
			projectId: graph.projectId,
			projectName: graph.projectName,
			projectType: graph.projectType,
			moduleCount: featureNodes.length,
			topModules: featureNodes
				.sort((a, b) => b.linkedFiles.length - a.linkedFiles.length)
				.slice(0, 10)
				.map(n => ({ id: n.id, name: n.name, fileCount: n.linkedFiles.length })),
			topologySummary: ctx.topologySummary,
			analysisMeta: graph.analysisMeta,
			analysisStatus: graph.analysisStatus,
			analysisError: graph.analysisError,
			graphVersion: graph.version,
		};
	}

	private buildNodeContext(projectId: string, nodeId: string): NodeContext | null {
		const graph = this.graphs.get(projectId);
		if (!graph) {
			return null;
		}
		return buildNodeContext(graph, nodeId);
	}

	private buildProjectContext(projectId: string): ProjectContext | null {
		const graph = this.graphs.get(projectId);
		if (!graph) {
			return null;
		}
		return buildProjectContext(graph);
	}

	private async tryLoadFromWorkspace(projectPath: string): Promise<GraphResponse | null> {
		const graphPath = path.join(projectPath, '.projectos', 'graph.json');
		try {
			const raw = await fs.readFile(graphPath, 'utf-8');
			let graph = migrateGraph(JSON.parse(raw) as ProjectGraph);
			if (!graph.nodes.some(n => n.id === 'sys_root')) {
				const hasAiHierarchy = graph.nodes.some(n => n.id.startsWith('feat_') && n.parentId && n.parentId !== 'sys_root');
				graph = {
					...graph,
					nodes: enrichTopology(
						graph.nodes.filter(n => n.id !== 'sys_root'),
						graph.edges,
						graph.projectName,
						{ preserveHierarchy: hasAiHierarchy || graph.version >= '0.3.0' },
					),
				};
			}
			const withSubmodules = expandSubmoduleNodes(graph.nodes);
			if (withSubmodules.length !== graph.nodes.length) {
				graph = {
					...graph,
					nodes: withSubmodules,
					topology: computeTopologyMeta(withSubmodules),
				};
			}
			this.graphs.set(graph.projectId, graph);
			this.projectPaths.set(graph.projectId, projectPath);
			return {
				projectId: graph.projectId,
				projectName: graph.projectName,
				projectType: graph.projectType,
				analysisStatus: graph.analysisStatus,
				projectPath,
				nodes: graph.nodes,
				edges: graph.edges,
			};
		} catch {
			return null;
		}
	}

	private getTopologyMarkdown(projectId: string, focusNodeId?: string): string {
		const graph = this.graphs.get(projectId);
		if (!graph) {
			return '';
		}
		return renderTopologyMarkdown(graph, { focusNodeId, includeFiles: !!focusNodeId });
	}

	/** Used by chat bridge via IPC wrapper on renderer */
	getChatContextPack(projectId: string, nodeId: string | null): { markdown: string; primaryFilePaths: string[] } | null {
		const pack = this.buildContextSync(projectId, nodeId);
		if (!pack) {
			return null;
		}
		return {
			markdown: pack.markdown,
			primaryFilePaths: pack.primaryFilePaths,
		};
	}

	private buildContextSync(projectId: string, nodeId: string | null): BuildContextResponse | null {
		const graph = this.graphs.get(projectId);
		if (!graph) {
			return null;
		}
		if (nodeId === null || nodeId === 'sys_root') {
			const ctx = buildProjectContext(graph);
			const topologyMarkdown = renderTopologyMarkdown(graph, { includeFiles: false });
			return {
				level: 'project',
				context: ctx,
				markdown: renderProjectContextMarkdown(ctx) + (topologyMarkdown ? `\n\n## 拓扑\n${topologyMarkdown}` : ''),
				primaryFilePaths: [],
			};
		}
		const ctx = buildNodeContext(graph, nodeId);
		if (!ctx) {
			return null;
		}
		const topologyMarkdown = renderTopologyMarkdown(graph, { focusNodeId: nodeId, includeFiles: true });
		return {
			level: 'node',
			context: ctx,
			markdown: renderNodeContextMarkdown(ctx, { topologyMarkdown }),
			primaryFilePaths: getNodeStageFilePaths(graph, nodeId),
		};
	}

	async buildContext(projectId: string, nodeId: string | null): Promise<BuildContextResponse | null> {
		const graph = this.graphs.get(projectId);
		const projectPath = this.projectPaths.get(projectId);
		if (!graph) {
			return null;
		}
		if (nodeId === null || nodeId === 'sys_root') {
			return this.buildContextSync(projectId, nodeId);
		}
		const ctx = buildNodeContext(graph, nodeId);
		if (!ctx) {
			return null;
		}
		const topologyMarkdown = renderTopologyMarkdown(graph, { focusNodeId: nodeId, includeFiles: true });
		const anchorTargets = getNodeAnchorSnippetTargets(graph, nodeId);
		const stagePaths = anchorTargets.map(t => t.path);
		const fileSnippets: Record<string, string> = {};
		if (projectPath) {
			for (const target of anchorTargets) {
				const linked = ctx.files.find(f => f.path === target.path);
				fileSnippets[target.path] = await extractFileSnippet(
					target.path,
					projectPath,
					target.summary ?? linked?.summary,
					{ startLine: target.startLine, endLine: target.endLine },
				);
			}
		}
		return {
			level: 'node',
			context: ctx,
			markdown: renderNodeContextMarkdown(ctx, { topologyMarkdown, fileSnippets }),
			primaryFilePaths: stagePaths,
		};
	}

	selectNodeContext(projectId: string, nodeId: string): SelectNodeContextResponse {
		return {
			detail: this.getNodeDetail(projectId, nodeId),
			pack: this.buildContextSync(projectId, nodeId),
		};
	}

	async selectProjectContext(projectId: string): Promise<SelectNodeContextResponse> {
		const projectDetail = this.getProjectDetail(projectId);
		const pack = await this.buildContext(projectId, null);
		return { detail: null, pack, projectDetail };
	}

	submitPrompt(_projectId: string, nodeId: string, text: string): SubmitPromptResponse {
		return {
			stub: true,
			nodeId,
			accepted: !!text.trim(),
			message: 'submitPrompt stub — M2 will run understand_prompt here',
		};
	}

	private async saveGraphToDisk(projectId: string, graph: ProjectGraph): Promise<void> {
		const projectPath = this.projectPaths.get(projectId);
		if (!projectPath) {
			return;
		}
		const graphPath = path.join(projectPath, '.projectos', 'graph.json');
		await fs.mkdir(path.dirname(graphPath), { recursive: true });
		await fs.writeFile(graphPath, JSON.stringify(graph, null, 2), 'utf-8');
		this.graphs.set(projectId, graph);
	}

	private graphResponse(graph: ProjectGraph, projectPath: string): GraphResponse {
		return {
			projectId: graph.projectId,
			projectName: graph.projectName,
			projectType: graph.projectType,
			version: graph.version,
			analysisStatus: graph.analysisStatus,
			analysisError: graph.analysisError,
			analysisMeta: graph.analysisMeta,
			projectPath,
			nodes: graph.nodes,
			edges: graph.edges,
		};
	}

	async expandNodeAnalysis(projectId: string, nodeId: string, llm?: ProjectOsAnalyzeLlmConfig): Promise<{ success: boolean; graph?: GraphResponse }> {
		const graph = this.graphs.get(projectId);
		const projectPath = this.projectPaths.get(projectId);
		if (!graph || !projectPath || !llm) {
			return { success: false };
		}
		const parentNode = graph.nodes.find(n => n.id === nodeId);
		if (!parentNode) {
			return { success: false };
		}
		const files = await scanFiles(projectPath);
		const pkg = await readPackageJson(projectPath);
		const projectType = await detectProjectType(projectPath, pkg, files);
		const routes = (projectType === 'nextjs-app' || projectType === 'nextjs-pages')
			? detectRoutes(files, projectType)
			: [];

		try {
			const { nodes: newChildren, edges: newEdges } = await expandNodeWithAi({
				projectPath,
				projectName: graph.projectName,
				projectType,
				parentNode,
				files,
				routes,
				llm,
				metricsService: this.metricsService,
			});
			const existingChildIds = new Set(graph.nodes.filter(n => n.parentId === nodeId).map(n => n.id));
			const toAdd = newChildren.filter(n => !existingChildIds.has(n.id));
			if (toAdd.length === 0) {
				return { success: true, graph: this.getGraph(projectId) ?? undefined };
			}
			const updatedNodes = [...graph.nodes, ...toAdd].map(n => {
				if (n.id === nodeId) {
					return {
						...n,
						children: [...new Set([...n.children, ...toAdd.map(c => c.id)])],
					};
				}
				return n;
			});
			const updated: ProjectGraph = {
				...graph,
				nodes: updatedNodes,
				edges: [...graph.edges, ...newEdges.filter(e => !graph.edges.some(x => x.id === e.id))],
				topology: computeTopologyMeta(updatedNodes),
			};
			await this.saveGraphToDisk(projectId, updated);
			return { success: true, graph: this.graphResponse(updated, projectPath) };
		} catch {
			return { success: false };
		}
	}

	async refineNode(projectId: string, nodeId: string, llm?: ProjectOsAnalyzeLlmConfig): Promise<RefineNodeResponse> {
		const graph = this.graphs.get(projectId);
		if (!graph || !llm) {
			return { suggestions: [] };
		}
		const resolved = resolveNodeId(nodeId, graph) ?? nodeId;
		const suggestions = await refineNodeWithLlm({
			graph,
			nodeId: resolved,
			llm,
			metricsService: this.metricsService,
		});
		return { suggestions };
	}

	async validateEdit(
		projectId: string,
		edit: GraphEdit,
		llm?: ProjectOsAnalyzeLlmConfig,
		guardMode: ArchitectureGuardMode = 'warn',
	): Promise<ValidateEditResponse> {
		const graph = this.graphs.get(projectId);
		if (!graph) {
			return { allowed: false, severity: 'critical', impacts: ['Graph not loaded'], alternatives: [] };
		}
		const local = localValidateEdit(graph, edit);
		if (guardMode === 'off' || !llm) {
			return local;
		}
		const ai = await validateEditWithLlm({ graph, edit, llm, metricsService: this.metricsService });
		return {
			allowed: local.allowed && ai.allowed,
			severity: ai.severity === 'critical' || local.severity === 'critical' ? 'critical' : ai.severity,
			impacts: [...local.impacts, ...ai.impacts],
			alternatives: ai.alternatives,
		};
	}

	async applyGraphEdit(
		projectId: string,
		edit: GraphEdit,
		force = false,
		llm?: ProjectOsAnalyzeLlmConfig,
		guardMode: ArchitectureGuardMode = 'warn',
	): Promise<ApplyGraphEditResponse> {
		const graph = this.graphs.get(projectId);
		const projectPath = this.projectPaths.get(projectId);
		if (!graph || !projectPath) {
			return { success: false, error: 'Graph not loaded' };
		}
		const validation = await this.validateEdit(projectId, edit, llm, guardMode);
		if (!force && shouldBlockEdit(validation, guardMode, edit)) {
			return { success: false, validation, error: 'Edit blocked by architecture guard' };
		}
		const { graph: updated, changelog } = applyGraphEdit(graph, edit);
		await this.saveGraphToDisk(projectId, updated);
		await persistGraphEdit(projectPath, updated, changelog);
		return {
			success: true,
			graph: this.graphResponse(updated, projectPath),
			validation,
		};
	}

	async getChangelog(projectId: string, nodeId?: string): Promise<GraphChangelogEntry[]> {
		const projectPath = this.projectPaths.get(projectId);
		if (!projectPath) {
			return [];
		}
		if (nodeId) {
			const graph = this.graphs.get(projectId);
			const resolved = graph ? (resolveNodeId(nodeId, graph) ?? nodeId) : nodeId;
			return readChangelog(projectPath, resolved);
		}
		return readChangelog(projectPath);
	}

	async exportChangelog(projectId: string): Promise<string> {
		const projectPath = this.projectPaths.get(projectId);
		if (!projectPath) {
			return '';
		}
		return exportChangelogText(projectPath);
	}

	resolveNodeId(projectId: string, nodeIdOrAlias: string): string | null {
		const graph = this.graphs.get(projectId);
		if (!graph) {
			return null;
		}
		return resolveNodeId(nodeIdOrAlias, graph);
	}
}
