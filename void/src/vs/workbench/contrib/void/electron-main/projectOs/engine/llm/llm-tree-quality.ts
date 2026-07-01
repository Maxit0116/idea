/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import type { LlmFunctionTreeNode } from './llm-function-tree-pass1.js';

const DIRECTORY_MIRROR_NAME = /^(android|ios|macos|macos|shared|common|lib|src|app|gradle|docs?|test|tests|assets?)$/i;
const DIRECTORY_MIRROR_SLUG = /^(mod[-_]|android|macos|shared|top[-_]|path[-_])/i;

/** Names that mirror repo folders/platforms — not user-facing product language. */
export function isDirectoryMirrorNode(node: Pick<LlmFunctionTreeNode, 'name' | 'nameEn' | 'slug' | 'summary'>): boolean {
	const name = node.name?.trim() ?? '';
	const nameEn = node.nameEn?.trim() ?? '';
	const slug = node.slug?.trim() ?? '';
	if (DIRECTORY_MIRROR_NAME.test(name) || DIRECTORY_MIRROR_NAME.test(nameEn)) {
		return true;
	}
	if (DIRECTORY_MIRROR_SLUG.test(slug)) {
		return true;
	}
	if (/^(包含|includes?)\s+\d+\s*(个)?(源)?文件/i.test(node.summary ?? '')) {
		return true;
	}
	return false;
}

export function filterDirectoryMirrorNodes(nodes: LlmFunctionTreeNode[]): LlmFunctionTreeNode[] {
	return nodes.filter(n => !isDirectoryMirrorNode(n));
}

export function computeTreeDepth(nodes: LlmFunctionTreeNode[]): number {
	const slugToParent = new Map(nodes.map(n => [n.slug, n.parentSlug]));
	function depthOf(slug: string, visiting = new Set<string>()): number {
		if (visiting.has(slug)) {
			return 1;
		}
		visiting.add(slug);
		const parent = slugToParent.get(slug);
		if (!parent) {
			return 1;
		}
		return 1 + depthOf(parent, visiting);
	}
	let max = 0;
	for (const n of nodes) {
		max = Math.max(max, depthOf(n.slug));
	}
	return max;
}

export function hasMinimumProductTree(nodes: LlmFunctionTreeNode[], minNodes = 8, minDepth = 2): boolean {
	if (nodes.length < minNodes) {
		return false;
	}
	if (computeTreeDepth(nodes) < minDepth) {
		return false;
	}
	const mirrorRatio = nodes.filter(isDirectoryMirrorNode).length / nodes.length;
	return mirrorRatio < 0.35;
}
