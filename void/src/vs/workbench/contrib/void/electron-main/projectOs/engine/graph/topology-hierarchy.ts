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

export interface EnrichTopologyOptions {
	/** When true, preserve AI-generated parentId/children; only inject sys_root and recompute depth/refs */
	preserveHierarchy?: boolean
}

/**
 * Enrich flat capability nodes into a Stello-style topology forest:
 * - One system root at depth 0
 * - Feature nodes as children at depth 1 (or deeper when nested routes detected)
 * - refs[] for cross-cluster import relationships (shown as dashed edges in UI)
 */
export function enrichTopology(
	nodes: FunctionalNode[],
	edges: FunctionalEdge[],
	projectName?: string,
	options?: EnrichTopologyOptions,
): FunctionalNode[] {
	if (nodes.length === 0) {
		return nodes;
	}

	const nodeMap = new Map(nodes.map(n => [n.id, n]));
	const root = createRootNode(nodes, projectName);
	const enriched: FunctionalNode[] = [root];

	if (options?.preserveHierarchy) {
		const preserved = enrichPreservingHierarchy(nodes, edges, nodeMap);
		enriched.push(...preserved);
	} else {
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
	}

	// Populate children arrays from parentId links
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

/** Preserve AI tree parent links; recompute depth from parent chain; attach orphans to sys_root */
function enrichPreservingHierarchy(
	nodes: FunctionalNode[],
	edges: FunctionalEdge[],
	nodeMap: Map<string, FunctionalNode>,
): FunctionalNode[] {
	const idSet = new Set(nodes.map(n => n.id));

	function resolveParentId(node: FunctionalNode): string {
		const pid = node.parentId;
		if (!pid || pid === node.id) {
			return ROOT_ID;
		}
		if (pid === ROOT_ID) {
			return ROOT_ID;
		}
		if (idSet.has(pid)) {
			return pid;
		}
		return ROOT_ID;
	}

	function computeDepth(nodeId: string, parentId: string, visiting = new Set<string>()): number {
		if (parentId === ROOT_ID) {
			return 1;
		}
		if (visiting.has(nodeId)) {
			return 1;
		}
		visiting.add(nodeId);
		const parent = nodeMap.get(parentId);
		if (!parent) {
			return 1;
		}
		const grandParent = resolveParentId(parent);
		return 1 + computeDepth(parentId, grandParent, visiting);
	}

	return nodes.map(node => {
		const parentId = resolveParentId(node);
		const depth = computeDepth(node.id, parentId);
		const refs = computeRefs(node.id, edges, parentId);
		return {
			...node,
			parentId,
			children: node.children ?? [],
			refs,
			depth,
		};
	});
}

function createRootNode(nodes: FunctionalNode[], projectName?: string): FunctionalNode {
	const featureNodes = nodes.filter(n => n.id !== ROOT_ID);
	const totalFiles = featureNodes.reduce((sum, n) => sum + n.linkedFiles.length, 0);
	const displayName = projectName?.trim() || '项目';
	return {
		id: ROOT_ID,
		type: 'capability',
		name: displayName,
		nameEn: 'Project Root',
		status: 'active',
		description: '项目根节点 — 所有功能模块从此展开',
		summary: `${featureNodes.length} 个功能模块，${totalFiles} 个关联文件`,
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
		granularity: 'project',
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
