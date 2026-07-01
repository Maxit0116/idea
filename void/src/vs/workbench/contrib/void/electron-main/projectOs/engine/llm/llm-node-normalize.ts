/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { slugify } from '../graph/node-id.js';
import type { LlmFunctionTreeNode } from './llm-function-tree-pass1.js';

function normalizePath(path: unknown): string | null {
	if (typeof path !== 'string' || !path.trim()) {
		return null;
	}
	return path.replace(/\\/g, '/').trim();
}

/** Local models often omit optional fields — fill defaults before graph conversion. */
export function normalizeLlmFunctionTreeNode(raw: Partial<LlmFunctionTreeNode> & Record<string, unknown>): LlmFunctionTreeNode {
	const name = typeof raw.name === 'string' && raw.name.trim()
		? raw.name.trim()
		: (typeof raw.slug === 'string' && raw.slug.trim() ? raw.slug.trim() : '未命名功能');
	const slug = typeof raw.slug === 'string' && raw.slug.trim()
		? slugify(raw.slug.trim())
		: slugify(name);

	type AnchorRole = LlmFunctionTreeNode['anchors'][0]['role'];
	type NormalizedAnchor = LlmFunctionTreeNode['anchors'][0];

	const anchors: NormalizedAnchor[] = (Array.isArray(raw.anchors) ? raw.anchors : [])
		.map((a): NormalizedAnchor | null => {
			if (!a || typeof a !== 'object') {
				return null;
			}
			const rec = a as Record<string, unknown>;
			const path = normalizePath(rec.path ?? rec.file ?? rec.filePath);
			if (!path) {
				return null;
			}
			const startLine = typeof rec.startLine === 'number' && rec.startLine > 0 ? rec.startLine : 1;
			const endLine = typeof rec.endLine === 'number' && rec.endLine >= startLine ? rec.endLine : startLine + 20;
			const role = rec.role;
			const validRole: AnchorRole = role === 'primary' || role === 'core' || role === 'api'
				|| role === 'supporting' || role === 'config' || role === 'test'
				? role : 'supporting';
			return {
				path,
				startLine,
				endLine,
				symbolName: typeof rec.symbolName === 'string' ? rec.symbolName : undefined,
				symbolKind: rec.symbolKind as NormalizedAnchor['symbolKind'],
				role: validRole,
				summary: typeof rec.summary === 'string' ? rec.summary : undefined,
			};
		})
		.filter((a): a is NormalizedAnchor => a !== null);

	const granularity = raw.granularity;
	const validGranularity = granularity === 'module' || granularity === 'feature'
		|| granularity === 'subfeature' || granularity === 'unit'
		? granularity : 'feature';

	return {
		slug,
		name,
		nameEn: typeof raw.nameEn === 'string' && raw.nameEn.trim() ? raw.nameEn.trim() : name,
		granularity: validGranularity,
		parentSlug: typeof raw.parentSlug === 'string' && raw.parentSlug.trim() ? raw.parentSlug.trim() : null,
		summary: typeof raw.summary === 'string' ? raw.summary : '',
		description: typeof raw.description === 'string' ? raw.description : (typeof raw.summary === 'string' ? raw.summary : ''),
		tags: Array.isArray(raw.tags) ? raw.tags.filter((t): t is string => typeof t === 'string') : undefined,
		anchors,
	};
}

export function normalizeLlmFunctionTreeNodes(nodes: unknown[]): LlmFunctionTreeNode[] {
	return nodes
		.filter(n => n && typeof n === 'object')
		.map(n => normalizeLlmFunctionTreeNode(n as Partial<LlmFunctionTreeNode> & Record<string, unknown>));
}
