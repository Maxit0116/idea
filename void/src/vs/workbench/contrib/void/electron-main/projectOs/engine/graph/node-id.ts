/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { createHash } from 'crypto';
import type { CodeAnchor, FunctionalNode, NodeGranularity, NodeLineage, ProjectGraph } from '../../../../common/projectOsTypes.js';

export function slugify(text: string | null | undefined): string {
	if (typeof text !== 'string' || !text.trim()) {
		return 'node';
	}
	return text
		.toLowerCase()
		.replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 48) || 'node';
}

function hash4(input: string): string {
	return createHash('sha256').update(input).digest('hex').slice(0, 4);
}

export function anchorHashKey(anchor: CodeAnchor | undefined): string {
	if (!anchor) {
		return 'none';
	}
	return `${anchor.path}:${anchor.startLine}-${anchor.endLine}`;
}

export function generateStaticNodeId(seed: string): string {
	const clean = seed.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 64);
	return `static_${clean}`;
}

export function generateAiNodeId(
	slug: string,
	parentId: string | null,
	primaryAnchor?: CodeAnchor,
): string {
	const safeSlug = slugify(slug);
	const hash = hash4(`${safeSlug}|${parentId ?? 'root'}|${anchorHashKey(primaryAnchor)}`);
	return `feat_${safeSlug}_${hash}`;
}

export function inferGranularityFromDepth(depth: number, id: string): NodeGranularity {
	if (id === 'sys_root') {
		return 'project';
	}
	if (depth <= 1) {
		return 'feature';
	}
	if (depth === 2) {
		return 'subfeature';
	}
	return 'unit';
}

export function defaultLineage(id: string, createdBy: NodeLineage['createdBy'] = 'static'): NodeLineage {
	return {
		slug: slugify(id.replace(/^(static_|feat_)/, '')),
		aliases: [],
		createdBy,
		createdAt: new Date().toISOString(),
	};
}

export function resolveNodeId(id: string, graph: ProjectGraph): string | null {
	if (graph.nodes.some(n => n.id === id)) {
		return id;
	}
	for (const node of graph.nodes) {
		if (node.lineage?.aliases.includes(id)) {
			return node.id;
		}
		if (node.lineage?.slug === id) {
			return node.id;
		}
	}
	return null;
}

export function resolveNode(graph: ProjectGraph, nodeIdOrAlias: string): FunctionalNode | null {
	const resolved = resolveNodeId(nodeIdOrAlias, graph);
	if (!resolved) {
		return null;
	}
	return graph.nodes.find(n => n.id === resolved) ?? null;
}
