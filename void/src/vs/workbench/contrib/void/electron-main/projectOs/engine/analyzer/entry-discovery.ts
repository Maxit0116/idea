/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import type { ProjectType, RouteEntry } from '../../../../common/projectOsTypes.js';
import type { ScannedFile } from './file-scanner.js';
import { discoverVoidEntries } from './void-entry-discovery.js';
import { discoverMobileAppEntries, extractReadmeProductFeatures, isLikelyMobileOrCrossPlatformProject } from './mobile-entry-discovery.js';

export type EntryKind = 'route' | 'contribution' | 'action' | 'panel' | 'ipc' | 'service' | 'readme'

export interface EntryPoint {
	id: string
	kind: EntryKind
	label: string
	files: string[]
	line?: number
	preview?: string
	exports?: string[]
}

export interface EntryDiscoveryResult {
	entries: EntryPoint[]
	readmeExcerpt?: string
	packageDescription?: string
	/** Bullet list from README ## 功能 — highest-priority product signals */
	productFeatures?: string[]
}

function firstLines(content: string, max = 30): string {
	return content.split('\n').slice(0, max).join('\n');
}

function discoverRouteEntries(routes: RouteEntry[], files: ScannedFile[]): EntryPoint[] {
	const fileMap = new Map(files.map(f => [f.relativePath.replace(/\\/g, '/'), f]));
	return routes
		.filter(r => (r.type === 'page' || r.type === 'api') && !!r.filePath && !!r.urlPath)
		.map(r => {
			const rel = r.filePath!.replace(/\\/g, '/');
			const file = fileMap.get(rel);
			return {
				id: `route_${r.urlPath!.replace(/[^a-z0-9]+/gi, '_') || 'root'}`,
				kind: 'route' as const,
				label: r.type === 'api' ? `API ${r.urlPath}` : `页面 ${r.urlPath}`,
				files: [rel],
				line: 1,
				preview: file?.content ? firstLines(file.content) : undefined,
				exports: file?.content ? extractExports(file.content) : undefined,
			};
		});
}

function extractExports(content: string): string[] {
	const exports: string[] = [];
	const re = /export\s+(?:async\s+)?(?:function|const|class|default\s+function)\s+(\w+)/g;
	let m: RegExpExecArray | null;
	while ((m = re.exec(content)) !== null) {
		exports.push(m[1]!);
	}
	return exports;
}

/** Discover product-facing entry points by project type. */
export function discoverEntries(input: {
	projectType: ProjectType
	files: ScannedFile[]
	routes: RouteEntry[]
	packageJson?: { description?: string; name?: string } | null
}): EntryDiscoveryResult {
	const normalized = input.files.map(f => ({
		...f,
		relativePath: f.relativePath.replace(/\\/g, '/'),
	}));

	let entries: EntryPoint[] = [];

	const readme = normalized.find(f =>
		/^readme\.md$/i.test(f.relativePath.split('/').pop() ?? ''),
	);

	if (input.projectType === 'nextjs-app' || input.projectType === 'nextjs-pages') {
		entries = discoverRouteEntries(input.routes, normalized);
	} else if (input.projectType === 'vscode-fork') {
		entries = discoverVoidEntries(normalized);
	} else if (isLikelyMobileOrCrossPlatformProject(normalized)) {
		entries = discoverMobileAppEntries(normalized, readme?.content);
		if (entries.length === 0) {
			entries = discoverVoidEntries(normalized);
		}
	} else {
		entries = discoverRouteEntries(input.routes, normalized);
		if (entries.length === 0) {
			entries = discoverVoidEntries(normalized);
		}
	}

	return {
		entries,
		readmeExcerpt: readme?.content ? firstLines(readme.content, 80) : undefined,
		packageDescription: input.packageJson?.description,
		productFeatures: readme?.content ? extractReadmeProductFeatures(readme.content) : undefined,
	};
}
