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
	return Math.round(120 + 40 * (1 - 1 / (1 + fileCount * 0.2)));
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

			flowNodes.push({
				id: node.id,
				type: 'funcNode',
				position: { x, y },
				data: {
					node,
					isSelected: false,
					depthColor: colorByDepth(node.depth),
					size: nodeSize(node),
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
	options?: { selectedId?: string | null },
): Edge[] {
	const edges: Edge[] = [];
	const selectedId = options?.selectedId ?? null;
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

		for (const refId of node.refs) {
			if (!nodeIds.has(refId)) continue;
			const highlighted = node.id === selectedId || refId === selectedId;
			edges.push({
				id: `ref-${node.id}-${refId}`,
				source: node.id,
				target: refId,
				type: 'smoothstep',
				style: {
					stroke: highlighted ? '#fbbf24' : '#f59e0b',
					strokeWidth: highlighted ? 2 : 1.2,
					strokeDasharray: '6 4',
					opacity: highlighted ? 0.9 : 0.5,
				},
			});
		}
	}

	for (const edge of functionalEdges) {
		if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) continue;
		// Skip if already shown as hierarchy or ref
		if (edges.some(e => (e.source === edge.source && e.target === edge.target))) continue;

		const highlighted = edge.source === selectedId || edge.target === selectedId;
		edges.push({
			id: `dep-${edge.id}`,
			source: edge.source,
			target: edge.target,
			type: 'smoothstep',
			animated: edge.relation === 'data_flows_to',
			style: {
				stroke: edge.relation === 'data_flows_to' ? '#f59e0b' : '#6b7280',
				strokeWidth: highlighted ? 2 : 1.2,
				opacity: highlighted ? 0.85 : edge.confidence * 0.6,
			},
			markerEnd: { type: MarkerType.ArrowClosed, color: '#6b7280' },
		});
	}

	return edges;
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
