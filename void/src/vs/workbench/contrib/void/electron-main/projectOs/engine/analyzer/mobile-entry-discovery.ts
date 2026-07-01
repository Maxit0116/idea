/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import type { ScannedFile } from './file-scanner.js';
import type { EntryPoint } from './entry-discovery.js';

const CODE_FILE = /\.(kt|kts|swift|tsx?|jsx?)$/i;

function lineNumberAt(content: string, index: number): number {
	return content.slice(0, index).split('\n').length;
}

function firstLines(content: string, max = 24): string {
	return content.split('\n').slice(0, max).join('\n');
}

function addEntry(entries: EntryPoint[], seen: Set<string>, entry: EntryPoint): void {
	const key = `${entry.kind}:${entry.id}`;
	if (seen.has(key)) {
		return;
	}
	seen.add(key);
	entries.push(entry);
}

/** Parse README ## 功能 section bullets into product capability hints. */
export function extractReadmeProductFeatures(readmeContent: string): string[] {
	const features: string[] = [];
	const section = readmeContent.match(/##\s*功能[\s\S]*?(?=\n##|\n#|$)/i)?.[0] ?? '';
	for (const line of section.split('\n')) {
		const bullet = line.match(/^\s*[-*]\s+(.+)/);
		if (bullet?.[1]) {
			features.push(bullet[1].trim());
		}
	}
	return features;
}

/** Discover Compose / SwiftUI screens, tabs, and README features for mobile / cross-platform apps. */
export function discoverMobileAppEntries(files: ScannedFile[], readmeExcerpt?: string): EntryPoint[] {
	const entries: EntryPoint[] = [];
	const seen = new Set<string>();
	const codeFiles = files.filter(f => CODE_FILE.test(f.relativePath) && f.content);

	for (const file of codeFiles) {
		const rel = file.relativePath.replace(/\\/g, '/');
		const content = file.content!;

		// Kotlin: sealed class Screen(..., val label: String)
		const screenRe = /(?:data\s+)?object\s+(\w+)\s*:\s*Screen\s*\(\s*"[^"]*"\s*,\s*"([^"]+)"/g;
		let m: RegExpExecArray | null;
		while ((m = screenRe.exec(content)) !== null) {
			const route = m[1]!;
			const label = m[2]!.trim();
			addEntry(entries, seen, {
				id: `screen_${route.toLowerCase()}`,
				kind: 'route',
				label,
				files: [rel],
				line: lineNumberAt(content, m.index),
				preview: firstLines(content.slice(m.index)),
			});
		}

		// Swift: case home, habits — with title "首页" in switch
		if (rel.endsWith('ContentView.swift') || rel.includes('/Views.swift')) {
			const caseRe = /case\s+(\w+)/g;
			const titleRe = /case\s+\.(\w+):\s*"([^"]+)"/g;
			const titles = new Map<string, string>();
			let tm: RegExpExecArray | null;
			while ((tm = titleRe.exec(content)) !== null) {
				titles.set(tm[1]!.toLowerCase(), tm[2]!.trim());
			}
			const navEnum = content.match(/enum\s+NavItem[\s\S]*?\{([\s\S]*?)\n\}/);
			if (navEnum) {
				let cm: RegExpExecArray | null;
				while ((cm = caseRe.exec(navEnum[1]!)) !== null) {
					const key = cm[1]!.toLowerCase();
					if (key === 'id') {
						continue;
					}
					const label = titles.get(key) ?? key;
					addEntry(entries, seen, {
						id: `nav_${key}`,
						kind: 'route',
						label,
						files: [rel],
						line: lineNumberAt(content, cm.index),
						preview: firstLines(content),
					});
				}
			}
		}

		// @Composable fun XxxScreen
		const composableRe = /@Composable\s+fun\s+(\w+Screen)\s*\(/g;
		while ((m = composableRe.exec(content)) !== null) {
			const fn = m[1]!;
			addEntry(entries, seen, {
				id: `composable_${fn.toLowerCase()}`,
				kind: 'panel',
				label: fn.replace(/Screen$/, '').replace(/([A-Z])/g, ' $1').trim() || fn,
				files: [rel],
				line: lineNumberAt(content, m.index),
				preview: firstLines(content.slice(m.index)),
			});
		}

		// Swift: struct XxxView: View
		const swiftViewRe = /struct\s+(\w+View)\s*:\s*View/g;
		while ((m = swiftViewRe.exec(content)) !== null) {
			const name = m[1]!;
			if (name === 'ContentView') {
				continue;
			}
			addEntry(entries, seen, {
				id: `view_${name.toLowerCase()}`,
				kind: 'panel',
				label: name.replace(/View$/, '').replace(/([A-Z])/g, ' $1').trim() || name,
				files: [rel],
				line: lineNumberAt(content, m.index),
				preview: firstLines(content.slice(m.index)),
			});
		}

		// Sync / data layer entry points
		if (/SyncWorker|syncNow|SupabaseClient|EventStore|AppRepository/i.test(rel)) {
			const label = rel.includes('sync') || /Sync/i.test(content.slice(0, 500))
				? '数据同步'
				: rel.includes('Repository') ? '数据仓库' : '后端数据访问';
			addEntry(entries, seen, {
				id: `service_${rel.replace(/[^a-z0-9]+/gi, '_').slice(0, 40)}`,
				kind: 'service',
				label,
				files: [rel],
				line: 1,
				preview: firstLines(content),
			});
		}
	}

	if (readmeExcerpt) {
		for (const feature of extractReadmeProductFeatures(readmeExcerpt)) {
			addEntry(entries, seen, {
				id: `readme_${feature.slice(0, 24).replace(/[^a-z0-9\u4e00-\u9fff]+/gi, '_')}`,
				kind: 'readme',
				label: feature,
				files: ['README.md'],
				line: 1,
				preview: feature,
			});
		}
	}

	return entries;
}

export function isLikelyMobileOrCrossPlatformProject(files: ScannedFile[]): boolean {
	const paths = files.map(f => f.relativePath.replace(/\\/g, '/').toLowerCase());
	return paths.some(p => p.startsWith('android/') || p.includes('/ios/'))
		|| paths.some(p => p.startsWith('macos/') || p.endsWith('.swift'))
		|| paths.some(p => p.includes('compose') || p.endsWith('.kt'));
}
