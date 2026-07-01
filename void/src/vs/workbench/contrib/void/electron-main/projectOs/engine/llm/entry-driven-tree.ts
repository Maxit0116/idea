/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import type { EntryDiscoveryResult, EntryPoint } from '../analyzer/entry-discovery.js';
import { slugify } from '../graph/node-id.js';
import type { LlmFunctionTreeNode } from './llm-function-tree-pass1.js';

const UI_PARENT = 'app-experience';

function shortFeatureName(label: string): string {
	return label.split('（')[0]!.split('(')[0]!.trim();
}

function anchorForEntry(entry: EntryPoint) {
	const path = entry.files[0];
	if (!path) {
		return [];
	}
	return [{
		path,
		startLine: entry.line ?? 1,
		endLine: (entry.line ?? 1) + 30,
		role: 'primary' as const,
		summary: entry.label,
	}];
}

function pickParentSlug(entry: EntryPoint, featureSlugs: Map<string, string>): string | null {
	const label = entry.label.toLowerCase();
	for (const [name, slug] of featureSlugs) {
		const key = name.toLowerCase();
		if (label.includes(key.slice(0, 2)) || key.includes(label) || name.includes(entry.label)) {
			return slug;
		}
	}
	if (entry.kind === 'route' || entry.kind === 'panel') {
		return UI_PARENT;
	}
	if (entry.kind === 'service') {
		for (const [name, slug] of featureSlugs) {
			if (/同步|数据|备份/.test(name)) {
				return slug;
			}
		}
	}
	return null;
}

/** Deterministic product tree from README + screen/service entries — no LLM required. */
export function buildEntryDrivenTree(discovery: EntryDiscoveryResult, projectName: string): LlmFunctionTreeNode[] {
	const nodes: LlmFunctionTreeNode[] = [];
	const featureSlugs = new Map<string, string>();
	const seenSlugs = new Set<string>();

	const productFeatures = discovery.productFeatures?.length
		? discovery.productFeatures
		: discovery.entries.filter(e => e.kind === 'readme').map(e => e.label);

	for (const raw of productFeatures.slice(0, 10)) {
		const name = shortFeatureName(raw);
		const slug = slugify(name);
		if (seenSlugs.has(slug)) {
			continue;
		}
		seenSlugs.add(slug);
		featureSlugs.set(raw, slug);
		nodes.push({
			slug,
			name,
			nameEn: name,
			granularity: 'feature',
			parentSlug: null,
			summary: name,
			description: `产品能力：${raw}`,
			anchors: discovery.entries.find(e => e.label === raw)?.files.length
				? anchorForEntry(discovery.entries.find(e => e.label === raw)!)
				: [],
		});
	}

	const hasUiRoutes = discovery.entries.some(e => e.kind === 'route' || e.kind === 'panel');
	if (hasUiRoutes && !seenSlugs.has(UI_PARENT)) {
		seenSlugs.add(UI_PARENT);
		nodes.push({
			slug: UI_PARENT,
			name: '应用界面',
			nameEn: 'App Screens',
			granularity: 'feature',
			parentSlug: null,
			summary: `${projectName} 的用户界面与导航`,
			description: '用户直接操作的页面、标签与流程',
			anchors: [],
		});
	}

	for (const entry of discovery.entries) {
		if (entry.kind === 'readme') {
			continue;
		}
		const parentSlug = pickParentSlug(entry, featureSlugs);
		const slug = slugify(`${parentSlug ?? 'feat'}-${entry.id}`);
		if (seenSlugs.has(slug)) {
			continue;
		}
		seenSlugs.add(slug);
		const granularity = entry.kind === 'service' ? 'subfeature' as const : 'unit' as const;
		nodes.push({
			slug,
			name: entry.label,
			nameEn: entry.label,
			granularity,
			parentSlug,
			summary: entry.label,
			description: entry.preview?.slice(0, 200) ?? entry.label,
			anchors: anchorForEntry(entry),
		});
	}

	return nodes;
}

/** Merge entry-driven nodes into LLM output without duplicating slugs/names. */
export function supplementWithEntryDriven(
	llmNodes: LlmFunctionTreeNode[],
	discovery: EntryDiscoveryResult,
	projectName: string,
): LlmFunctionTreeNode[] {
	const driven = buildEntryDrivenTree(discovery, projectName);
	const existingNames = new Set(llmNodes.map(n => n.name.toLowerCase()));
	const existingSlugs = new Set(llmNodes.map(n => n.slug));
	const extra = driven.filter(d => !existingSlugs.has(d.slug) && !existingNames.has(d.name.toLowerCase()));
	return [...llmNodes, ...extra];
}
