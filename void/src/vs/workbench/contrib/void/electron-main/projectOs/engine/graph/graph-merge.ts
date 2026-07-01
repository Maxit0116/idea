/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import type { FunctionalNode, GraphChangelogEntry, ProjectGraph } from '../../../../common/projectOsTypes.js';
import { anchorsOverlap } from './anchor-validator.js';
import { slugify } from './node-id.js';

const STALE_ID_PATTERN = /^(mod_|static_|contrib_)/

export interface MergeResult {
	nodes: FunctionalNode[]
	changelog: GraphChangelogEntry[]
}

function anchorOverlapScore(a: FunctionalNode, b: FunctionalNode): number {
	let score = 0;
	for (const aa of a.anchors ?? []) {
		for (const bb of b.anchors ?? []) {
			if (anchorsOverlap(aa, bb)) {
				score += 1;
			}
		}
	}
	return score;
}

function nameSimilarity(a: string, b: string): number {
	const sa = slugify(a);
	const sb = slugify(b);
	if (sa === sb) {
		return 1;
	}
	if (sa.includes(sb) || sb.includes(sa)) {
		return 0.5;
	}
	return 0;
}

function findBestMatch(
	newNode: FunctionalNode,
	oldNodes: FunctionalNode[],
	used: Set<string>,
): FunctionalNode | null {
	let best: FunctionalNode | null = null;
	let bestScore = 0;

	for (const old of oldNodes) {
		if (used.has(old.id) || old.id === 'sys_root') {
			continue;
		}
		let score = 0;
		if (newNode.lineage?.slug && old.lineage?.slug && newNode.lineage.slug === old.lineage.slug) {
			score += 10;
		}
		score += anchorOverlapScore(newNode, old) * 3;
		if (newNode.sourceClusterIds?.length && old.sourceClusterIds?.length) {
			const overlap = newNode.sourceClusterIds.filter(id => old.sourceClusterIds!.includes(id));
			score += overlap.length * 2;
		}
		score += nameSimilarity(newNode.name, old.name) * 2;
		if (score > bestScore) {
			bestScore = score;
			best = old;
		}
	}

	return bestScore >= 2 ? best : null;
}

/** Merge newly analyzed nodes with previous graph, preserving lineage aliases */
export function mergeGraphNodes(
	oldGraph: ProjectGraph | null,
	newNodes: FunctionalNode[],
): MergeResult {
	if (!oldGraph) {
		return { nodes: newNodes, changelog: [] };
	}

	const oldFeatureNodes = oldGraph.nodes.filter(n => n.id !== 'sys_root');
	const usedOld = new Set<string>();
	const changelog: GraphChangelogEntry[] = [];
	const merged: FunctionalNode[] = [];

	for (const node of newNodes) {
		if (node.id === 'sys_root') {
			merged.push(node);
			continue;
		}
		const match = findBestMatch(node, oldFeatureNodes, usedOld);
		if (!match) {
			merged.push(node);
			changelog.push({
				at: new Date().toISOString(),
				toId: node.id,
				reason: 'reanalyze',
				note: `New node: ${node.name}`,
			});
			continue;
		}

		usedOld.add(match.id);
		const aliases = [...new Set([...(match.lineage?.aliases ?? []), match.id])];
		const preferNewId = node.id.startsWith('feat_') && STALE_ID_PATTERN.test(match.id);
		const mergedId = node.id;
		if (mergedId !== match.id) {
			aliases.push(preferNewId ? match.id : mergedId);
			changelog.push({
				at: new Date().toISOString(),
				fromId: match.id,
				toId: mergedId,
				reason: 'reanalyze',
				note: `Merged by similarity: ${match.name} → ${node.name}`,
			});
		}

		merged.push({
			...node,
			id: mergedId,
			lineage: {
				slug: node.lineage?.slug ?? match.lineage?.slug ?? slugify(node.name),
				aliases: [...new Set(aliases.filter(a => a !== mergedId))],
				createdBy: node.lineage?.createdBy ?? match.lineage?.createdBy ?? 'ai',
				createdAt: node.lineage?.createdAt ?? match.lineage?.createdAt ?? new Date().toISOString(),
			},
		});
	}

	return { nodes: merged, changelog };
}
