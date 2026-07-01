/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------
 *
 * Constellation layout adapted from Stello Board's graph-layout.
 * @see https://github.com/stello-agent/stello-board/blob/main/src/lib/graph-layout.ts
 */

import type { Node, Edge } from '@xyflow/react';
import { MarkerType } from '@xyflow/react';
import type { FunctionalNode, FunctionalEdge } from '../../../../common/projectOsTypes.js';

/** Golden angle — natural distribution on each depth ring */
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

const DEPTH_COLORS = ['#22c55e', '#3b82f6', '#a855f7', '#f59e0b', '#ef4444', '#6b7280'];

export function colorByDepth(depth: number): string {
	return DEPTH_COLORS[depth % DEPTH_COLORS.length] ?? '#6b7280';
}

interface LayoutConfig {
	centerX: number;
	centerY: number;
	ringSpacing: number;
}

const DEFAULTS: LayoutConfig = {
	centerX: 0,
	centerY: 0,
	ringSpacing: 200,
};

function nodeSize(node: FunctionalNode): number {
	const fileCount = node.linkedFiles.length;
	const granScale = node.granularity === 'unit' ? 0.75
		: node.granularity === 'subfeature' ? 0.88
			: 1;
	return Math.round((120 + 40 * (1 - 1 / (1 + fileCount * 0.2))) * granScale);
}

function shareAncestorChain(a: FunctionalNode, b: FunctionalNode, nodes: FunctionalNode[]): boolean {
	const byId = new Map(nodes.map(n => [n.id, n]));
	const ancestors = (id: string): Set<string> => {
		const s = new Set<string>();
		let pid = byId.get(id)?.parentId ?? null;
		while (pid) {
			s.add(pid);
			pid = byId.get(pid)?.parentId ?? null;
		}
		return s;
	};
	const aa = ancestors(a.id);
	const bb = ancestors(b.id);
	for (const id of aa) {
		if (bb.has(id)) {
			return true;
		}
	}
	return false;
}

export function isCrossBranchEdge(
	edge: FunctionalEdge,
	nodes: FunctionalNode[],
): boolean {
	const src = nodes.find(n => n.id === edge.source);
	const tgt = nodes.find(n => n.id === edge.target);
	if (!src || !tgt) {
		return false;
	}
	if (src.parentId === tgt.parentId) {
		return false;
	}
	return !shareAncestorChain(src, tgt, nodes);
}

export type CrossBranchEdgeMode = 'always' | 'on-select' | 'never';

export function getNodeVisualOpacity(
	nodeId: string,
	selectedId: string | null,
	nodes: FunctionalNode[],
): number {
	if (!selectedId) {
		return 1;
	}
	if (nodeId === selectedId) {
		return 1;
	}
	const byId = new Map(nodes.map(n => [n.id, n]));
	const ancestors = ancestorIdsForNode(nodes, selectedId);
	const descendants = nodes.filter(n => n.parentId === selectedId || ancestors.includes(n.parentId ?? ''));
	if (ancestors.includes(nodeId) || descendants.some(d => d.id === nodeId)) {
		return 0.9;
	}
	const selected = byId.get(selectedId);
	const node = byId.get(nodeId);
	if (selected?.crossRefs?.includes(nodeId) || node?.crossRefs?.includes(selectedId)) {
		return 0.75;
	}
	return 0.45;
}

/** Stello constellation layout: root at center, children on depth rings */
export function computeTopologyLayout(
	nodes: FunctionalNode[],
	config?: Partial<LayoutConfig>,
): Node[] {
	if (nodes.length === 0) {
		return [];
	}

	const c = { ...DEFAULTS, ...config };
	const depthGroups = new Map<number, FunctionalNode[]>();

	for (const node of nodes) {
		const group = depthGroups.get(node.depth) ?? [];
		group.push(node);
		depthGroups.set(node.depth, group);
	}

	const flowNodes: Node[] = [];

	for (const [depth, group] of depthGroups) {
		const count = group.length;
		for (let i = 0; i < count; i++) {
			const node = group[i]!;
			let x: number;
			let y: number;

			if (depth === 0) {
				x = c.centerX;
				y = c.centerY;
			} else {
				const radius = depth * c.ringSpacing;
				const angle = count === 1 ? 0 : i * ((2 * Math.PI) / count) + depth * GOLDEN_ANGLE;
				x = c.centerX + radius * Math.cos(angle);
				y = c.centerY + radius * Math.sin(angle);
			}

			const size = nodeSize(node);
			flowNodes.push({
				id: node.id,
				type: 'funcNode',
				position: { x, y },
				width: size,
				height: Math.round(size * 0.72),
				data: {
					node,
					isSelected: false,
					depthColor: colorByDepth(node.depth),
					size,
				},
			});
		}
	}

	return flowNodes;
}

/** Hierarchy edges (parent→child) + ref edges (dashed) + functional dependency edges */
export function computeTopologyEdges(
	nodes: FunctionalNode[],
	functionalEdges: FunctionalEdge[],
	options?: {
		selectedId?: string | null
		crossBranchMode?: CrossBranchEdgeMode
	},
): Edge[] {
	const edges: Edge[] = [];
	const selectedId = options?.selectedId ?? null;
	const crossBranchMode = options?.crossBranchMode ?? 'on-select';
	const nodeIds = new Set(nodes.map(n => n.id));

	for (const node of nodes) {
		if (node.parentId && nodeIds.has(node.parentId)) {
			const highlighted = node.id === selectedId || node.parentId === selectedId;
			edges.push({
				id: `hier-${node.parentId}-${node.id}`,
				source: node.parentId,
				target: node.id,
				type: 'smoothstep',
				style: {
					stroke: highlighted ? '#22c55e' : '#4b5563',
					strokeWidth: highlighted ? 2.5 : 1.5,
					opacity: highlighted ? 0.95 : 0.55,
				},
			});
		}
	}

	for (const edge of functionalEdges) {
		if (edge.relation === 'imports') {
			continue;
		}
		if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) continue;
		if (edges.some(e => (e.source === edge.source && e.target === edge.target))) continue;

		const crossBranch = isCrossBranchEdge(edge, nodes);
		if (crossBranch && crossBranchMode === 'never') {
			continue;
		}
		if (crossBranch && crossBranchMode === 'on-select' && selectedId !== edge.source && selectedId !== edge.target) {
			continue;
		}

		const highlighted = edge.source === selectedId || edge.target === selectedId;
		const baseOpacity = crossBranch
			? (crossBranchMode === 'always' ? edge.confidence * 0.4 : edge.confidence * 0.85)
			: (highlighted ? 0.85 : edge.confidence * 0.6);

		edges.push({
			id: `dep-${edge.id}`,
			source: edge.source,
			target: edge.target,
			type: 'smoothstep',
			animated: edge.relation === 'data_flows_to',
			style: {
				stroke: crossBranch
					? (highlighted ? '#94a3b8' : '#64748b')
					: (edge.relation === 'data_flows_to' ? '#f59e0b' : '#6b7280'),
				strokeWidth: highlighted ? 2 : (crossBranch ? 1 : 1.2),
				opacity: highlighted && crossBranch ? Math.min(0.95, baseOpacity + 0.1) : baseOpacity,
				strokeDasharray: crossBranch ? '6 4' : undefined,
			},
			markerEnd: { type: MarkerType.ArrowClosed, color: crossBranch ? '#64748b' : '#6b7280' },
		});
	}

	return edges;
}

/** Default view: root + depth-1 feature modules only */
export const DEFAULT_VISIBLE_MAX_DEPTH = 1;

const ROOT_ID = 'sys_root';
const MIN_FILES_PER_SUB = 2;
const MIN_TOTAL_FILES = 4;
const MAX_SUBMODULES = 20;

const SEGMENT_NAMES: Record<string, { name: string; nameEn: string }> = {
	browser: { name: '浏览器端', nameEn: 'Browser' },
	'electron-main': { name: 'Electron 主进程', nameEn: 'Electron Main' },
	common: { name: '公共模块', nameEn: 'Common' },
	components: { name: '组件层', nameEn: 'Components' },
	services: { name: '服务层', nameEn: 'Services' },
	api: { name: 'API 层', nameEn: 'API Layer' },
	lib: { name: '核心库', nameEn: 'Core Library' },
	react: { name: 'React UI', nameEn: 'React UI' },
	app: { name: '应用层', nameEn: 'App' },
	pages: { name: '页面', nameEn: 'Pages' },
};

function humanizeSegment(segment: string): { name: string; nameEn: string } {
	const known = SEGMENT_NAMES[segment.toLowerCase()];
	if (known) {
		return known;
	}
	const title = segment
		.replace(/[-_]/g, ' ')
		.replace(/([a-z])([A-Z])/g, '$1 $2')
		.replace(/\b\w/g, c => c.toUpperCase());
	return { name: title, nameEn: title };
}

function longestCommonDirDepth(paths: string[]): number {
	if (paths.length === 0) {
		return 0;
	}
	const split = paths.map(p => p.split('/'));
	const max = Math.min(...split.map(p => p.length)) - 1;
	let depth = 0;
	for (let i = 0; i < max; i++) {
		const seg = split[0]![i];
		if (split.every(parts => parts[i] === seg)) {
			depth = i + 1;
		} else {
			break;
		}
	}
	return depth;
}

/** Derive child nodes from linkedFiles when graph has no persisted children (cached graphs). */
export function deriveSubmoduleNodes(parent: FunctionalNode): FunctionalNode[] {
	if (parent.linkedFiles.length < MIN_TOTAL_FILES) {
		return [];
	}
	const paths = parent.linkedFiles.map(f => f.path.replace(/\\/g, '/'));
	const clusterDepth = longestCommonDirDepth(paths);
	const groups = new Map<string, typeof parent.linkedFiles>();

	for (const lf of parent.linkedFiles) {
		const parts = lf.path.replace(/\\/g, '/').split('/');
		const seg = parts[clusterDepth];
		const key = seg ?? '_direct';
		const bucket = groups.get(key) ?? [];
		bucket.push(lf);
		groups.set(key, bucket);
	}

	const eligible = Array.from(groups.entries())
		.filter(([, files]) => files.length >= MIN_FILES_PER_SUB)
		.sort((a, b) => b[1].length - a[1].length)
		.slice(0, MAX_SUBMODULES);

	if (eligible.length < 2) {
		return [];
	}

	return eligible.map(([segment, files]) => {
		const labels = segment === '_direct'
			? { name: '根目录文件', nameEn: 'Root Files' }
			: humanizeSegment(segment);
		const id = `${parent.id}::sub::${segment.replace(/[^a-zA-Z0-9_]/g, '_')}`;
		return {
			id,
			type: 'capability' as const,
			name: labels.name,
			nameEn: labels.nameEn,
			status: parent.status,
			description: `${labels.name}（${parent.name} 子模块）`,
			summary: `包含 ${files.length} 个源文件`,
			parentId: parent.id,
			children: [],
			refs: [],
			depth: parent.depth + 1,
			linkedFiles: files,
			upstream: [],
			downstream: [],
			preview: null,
			confidence: Math.min(0.85, 0.5 + files.length * 0.02),
			tags: ['submodule', segment === '_direct' ? 'root' : segment],
		};
	});
}

/** Merge persisted graph nodes with derived submodules for modules lacking children. */
export function buildDisplayGraph(nodes: FunctionalNode[]): FunctionalNode[] {
	const result = [...nodes];
	const byId = new Map(result.map(n => [n.id, n]));
	const hasGraphChild = (id: string) => result.some(n => n.parentId === id);

	for (const node of nodes) {
		if (node.id === ROOT_ID || hasGraphChild(node.id)) {
			continue;
		}
		for (const derived of deriveSubmoduleNodes(node)) {
			if (!byId.has(derived.id)) {
				result.push(derived);
				byId.set(derived.id, derived);
			}
		}
	}

	return result.map(node => {
		const childIds = result.filter(n => n.parentId === node.id).map(n => n.id);
		return childIds.length > 0 ? { ...node, children: childIds } : node;
	});
}

export function getDirectChildren(nodes: FunctionalNode[], parentId: string): FunctionalNode[] {
	return nodes.filter(n => n.parentId === parentId);
}

export function hasDisplayChildren(nodes: FunctionalNode[], nodeId: string): boolean {
	return getDirectChildren(nodes, nodeId).length > 0;
}

/** Breadcrumb path from project root to focus node (exclusive of sys_root). */
export function focusBreadcrumb(nodes: FunctionalNode[], focusNodeId: string | null): FunctionalNode[] {
	if (!focusNodeId || focusNodeId === ROOT_ID) {
		return [];
	}
	const byId = new Map(nodes.map(n => [n.id, n]));
	const trail: FunctionalNode[] = [];
	let cur = byId.get(focusNodeId) ?? null;
	while (cur && cur.id !== ROOT_ID) {
		trail.unshift(cur);
		cur = cur.parentId ? byId.get(cur.parentId) ?? null : null;
	}
	return trail;
}

/**
 * Drill-down view: focus node at center (depth 0) with direct children on ring 1.
 * Project view (focus null): root + depth-1 modules via progressive expansion.
 */
export function filterNodesForMapView(
	nodes: FunctionalNode[],
	focusNodeId: string | null,
	expandedNodeIds: ReadonlySet<string>,
	maxDefaultDepth = DEFAULT_VISIBLE_MAX_DEPTH,
): FunctionalNode[] {
	if (!focusNodeId || focusNodeId === ROOT_ID) {
		return filterNodesByProgressiveExpansion(nodes, expandedNodeIds, maxDefaultDepth);
	}

	const byId = new Map(nodes.map(n => [n.id, n]));
	const focus = byId.get(focusNodeId);
	if (!focus) {
		return filterNodesByProgressiveExpansion(nodes, expandedNodeIds, maxDefaultDepth);
	}

	const visible = new Set<string>([focusNodeId]);
	for (const child of getDirectChildren(nodes, focusNodeId)) {
		visible.add(child.id);
		if (expandedNodeIds.has(child.id)) {
			for (const gc of getDirectChildren(nodes, child.id)) {
				visible.add(gc.id);
			}
		}
	}

	return nodes.filter(n => visible.has(n.id));
}

/** Re-map depths so the focused node sits at the layout center (depth 0). */
export function remapDepthsForFocus(nodes: FunctionalNode[], focusNodeId: string | null): FunctionalNode[] {
	if (!focusNodeId || focusNodeId === ROOT_ID) {
		return nodes;
	}
	const byId = new Map(nodes.map(n => [n.id, n]));

	function relativeDepth(nodeId: string): number {
		if (nodeId === focusNodeId) {
			return 0;
		}
		let depth = 0;
		let cur = byId.get(nodeId);
		while (cur?.parentId && cur.parentId !== focusNodeId) {
			depth++;
			cur = byId.get(cur.parentId);
			if (!cur) {
				break;
			}
		}
		return depth + 1;
	}

	return nodes.map(n => ({ ...n, depth: relativeDepth(n.id) }));
}

/**
 * Progressive expansion: show depth <= maxDepth, plus descendants of expanded nodes.
 */
export function filterNodesByProgressiveExpansion(
	nodes: FunctionalNode[],
	expandedNodeIds: ReadonlySet<string>,
	maxDefaultDepth = DEFAULT_VISIBLE_MAX_DEPTH,
): FunctionalNode[] {
	const byId = new Map(nodes.map(n => [n.id, n]));
	const visible = new Set<string>();

	function isAncestorExpanded(node: FunctionalNode): boolean {
		let pid = node.parentId;
		while (pid) {
			if (expandedNodeIds.has(pid)) {
				return true;
			}
			pid = byId.get(pid)?.parentId ?? null;
		}
		return false;
	}

	for (const node of nodes) {
		if (node.id === ROOT_ID) {
			visible.add(node.id);
			continue;
		}
		if (node.depth <= maxDefaultDepth) {
			visible.add(node.id);
			continue;
		}
		if (expandedNodeIds.has(node.id)) {
			visible.add(node.id);
			continue;
		}
		if (isAncestorExpanded(node)) {
			visible.add(node.id);
		}
	}

	// Always include ancestors of visible nodes
	let changed = true;
	while (changed) {
		changed = false;
		for (const id of [...visible]) {
			const node = byId.get(id);
			if (node?.parentId && !visible.has(node.parentId)) {
				visible.add(node.parentId);
				changed = true;
			}
		}
	}

	return nodes.filter(n => visible.has(n.id));
}

/** Expand path to node for search hits */
export function ancestorIdsForNode(nodes: FunctionalNode[], nodeId: string): string[] {
	const byId = new Map(nodes.map(n => [n.id, n]));
	const ids: string[] = [];
	let pid = byId.get(nodeId)?.parentId ?? null;
	while (pid) {
		ids.push(pid);
		pid = byId.get(pid)?.parentId ?? null;
	}
	return ids;
}

/** Stello-style search: include matching nodes + all ancestors */
export function filterNodesWithAncestors(
	nodes: FunctionalNode[],
	query: string,
): FunctionalNode[] {
	const normalized = query.trim().toLowerCase();
	if (!normalized) {
		return nodes;
	}

	const byId = new Map(nodes.map(n => [n.id, n]));
	const visibleIds = new Set<string>();

	for (const node of nodes) {
		const matches =
			node.name.toLowerCase().includes(normalized) ||
			node.nameEn.toLowerCase().includes(normalized) ||
			node.id.toLowerCase().includes(normalized) ||
			node.tags.some(t => t.toLowerCase().includes(normalized)) ||
			node.preview?.route?.toLowerCase().includes(normalized);

		if (!matches) continue;

		visibleIds.add(node.id);
		let pid: string | null = node.parentId;
		while (pid) {
			visibleIds.add(pid);
			pid = byId.get(pid)?.parentId ?? null;
		}
	}

	return nodes.filter(n => visibleIds.has(n.id));
}
