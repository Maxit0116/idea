/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------
 *
 * Stello-inspired topology enrichment: single root, depth rings, parent/child tree,
 * and cross-reference edges (refs) separate from functional dependency edges.
 * @see https://github.com/stello-agent/stello
 */

import type { FunctionalNode, FunctionalEdge } from '../../../../common/projectOsTypes.js';

const ROOT_ID = 'sys_root';

/**
 * Enrich flat capability nodes into a Stello-style topology forest:
 * - One system root at depth 0
 * - Feature nodes as children at depth 1 (or deeper when nested routes detected)
 * - refs[] for cross-cluster import relationships (shown as dashed edges in UI)
 */
export function enrichTopology(
	nodes: FunctionalNode[],
	edges: FunctionalEdge[],
): FunctionalNode[] {
	if (nodes.length === 0) {
		return nodes;
	}

	const nodeMap = new Map(nodes.map(n => [n.id, n]));
	const root = createRootNode(nodes);
	const enriched: FunctionalNode[] = [root];

	// Detect nested routes: /dashboard/settings → settings nested under dashboard
	const nested = detectNestedHierarchy(nodes);

	for (const node of nodes) {
		const parentId = nested.get(node.id) ?? ROOT_ID;
		const depth = parentId === ROOT_ID ? 1 : (nodeMap.get(parentId)?.depth ?? 0) + 1;
		const refs = computeRefs(node.id, edges, parentId);

		enriched.push({
			...node,
			parentId,
			children: [],
			refs,
			depth,
		});
	}

	// Populate children arrays
	for (const node of enriched) {
		if (node.parentId) {
			const parent = enriched.find(n => n.id === node.parentId);
			if (parent && !parent.children.includes(node.id)) {
				parent.children.push(node.id);
			}
		}
	}

	return enriched;
}

function createRootNode(nodes: FunctionalNode[]): FunctionalNode {
	const totalFiles = nodes.reduce((sum, n) => sum + n.linkedFiles.length, 0);
	return {
		id: ROOT_ID,
		type: 'capability',
		name: '项目架构',
		nameEn: 'System Root',
		status: 'active',
		description: 'Architecture root — all capability nodes branch from here',
		summary: `${nodes.length} 个功能模块，${totalFiles} 个关联文件`,
		parentId: null,
		children: [],
		refs: [],
		depth: 0,
		linkedFiles: [],
		upstream: [],
		downstream: [],
		preview: null,
		confidence: 1,
		tags: ['infrastructure'],
	};
}

/** If route A is a prefix of route B, nest B under A (Stello parent-child). */
function detectNestedHierarchy(nodes: FunctionalNode[]): Map<string, string> {
	const parentMap = new Map<string, string>();
	const routeNodes = nodes
		.filter(n => n.preview?.route)
		.map(n => ({ id: n.id, route: n.preview!.route! }))
		.sort((a, b) => a.route.length - b.route.length);

	for (const child of routeNodes) {
		let bestParent: string | null = null;
		let bestLen = 0;
		for (const parent of routeNodes) {
			if (parent.id === child.id) continue;
			const prefix = parent.route === '/' ? '' : parent.route;
			if (prefix && child.route.startsWith(prefix + '/') && prefix.length > bestLen) {
				bestParent = parent.id;
				bestLen = prefix.length;
			}
		}
		if (bestParent) {
			parentMap.set(child.id, bestParent);
		}
	}

	return parentMap;
}

/** Cross-references: dependency edges that are NOT parent-child hierarchy. */
function computeRefs(
	nodeId: string,
	edges: FunctionalEdge[],
	parentId: string,
): string[] {
	const refs = new Set<string>();
	for (const edge of edges) {
		if (edge.source === nodeId && edge.target !== parentId) {
			refs.add(edge.target);
		}
		if (edge.target === nodeId && edge.source !== parentId) {
			refs.add(edge.source);
		}
	}
	return Array.from(refs);
}

export function computeTopologyMeta(nodes: FunctionalNode[]) {
	const rootIds = nodes.filter(n => n.parentId === null).map(n => n.id);
	const maxDepth = Math.max(0, ...nodes.map(n => n.depth));
	return { rootIds, maxDepth, totalNodes: nodes.length };
}
