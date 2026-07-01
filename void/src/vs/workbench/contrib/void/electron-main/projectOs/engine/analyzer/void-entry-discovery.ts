/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import type { ScannedFile } from './file-scanner.js';
import type { EntryPoint } from './entry-discovery.js';

const CODE_FILE = /\.(ts|tsx|js|jsx|mjs|cjs)$/i;

function lineNumberAt(content: string, index: number): number {
	return content.slice(0, index).split('\n').length;
}

function firstLines(content: string, max = 30): string {
	return content.split('\n').slice(0, max).join('\n');
}

function extractExports(content: string): string[] {
	const exports: string[] = [];
	const re = /export\s+(?:async\s+)?(?:function|const|class)\s+(\w+)/g;
	let m: RegExpExecArray | null;
	while ((m = re.exec(content)) !== null) {
		exports.push(m[1]!);
	}
	return exports;
}

function addEntry(
	entries: EntryPoint[],
	seen: Set<string>,
	entry: EntryPoint,
): void {
	const key = `${entry.kind}:${entry.id}`;
	if (seen.has(key)) {
		const existing = entries.find(e => e.id === entry.id && e.kind === entry.kind);
		if (existing) {
			for (const f of entry.files) {
				if (!existing.files.includes(f)) {
					existing.files.push(f);
				}
			}
		}
		return;
	}
	seen.add(key);
	entries.push(entry);
}

/** Scan vscode-fork / void project for product-facing entry signals. */
export function discoverVoidEntries(files: ScannedFile[]): EntryPoint[] {
	const entries: EntryPoint[] = [];
	const seen = new Set<string>();
	const codeFiles = files.filter(f => CODE_FILE.test(f.relativePath) && f.content);

	for (const file of codeFiles) {
		const rel = file.relativePath.replace(/\\/g, '/');
		const content = file.content!;

		if (rel.endsWith('.contribution.ts')) {
			const base = rel.split('/').pop()!.replace('.contribution.ts', '');
			addEntry(entries, seen, {
				id: `contrib_${base}`,
				kind: 'contribution',
				label: `${base} 模块贡献`,
				files: [rel],
				line: 1,
				preview: firstLines(content),
				exports: extractExports(content),
			});
		}

		const actionRe = /registerAction2\s*\(\s*class\s+extends\s+Action2\s*\{[\s\S]*?constructor\s*\(\s*\)\s*\{[\s\S]*?super\s*\(\s*\{[\s\S]*?(?:title|label)\s*:\s*(?:localize2?\([^,]+,\s*)?['"`]([^'"`]+)['"`]/g;
		let actionMatch: RegExpExecArray | null;
		while ((actionMatch = actionRe.exec(content)) !== null) {
			const title = actionMatch[1]!.trim();
			const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 40) || 'action';
			addEntry(entries, seen, {
				id: `action_${slug}`,
				kind: 'action',
				label: title,
				files: [rel],
				line: lineNumberAt(content, actionMatch.index),
				preview: content.slice(actionMatch.index, actionMatch.index + 200),
			});
		}

		const mountRe = /export\s+const\s+(mount\w+)\s*=/g;
		let mountMatch: RegExpExecArray | null;
		while ((mountMatch = mountRe.exec(content)) !== null) {
			const mountName = mountMatch[1]!;
			addEntry(entries, seen, {
				id: `panel_${mountName}`,
				kind: 'panel',
				label: mountName.replace(/^mount/, '').replace(/([A-Z])/g, ' $1').trim() || mountName,
				files: [rel],
				line: lineNumberAt(content, mountMatch.index),
				preview: firstLines(content.slice(mountMatch.index)),
				exports: [mountName],
			});
		}

		if (rel.includes('projectOsChannel')) {
			const caseRe = /case\s+['"`](\w+)['"`]\s*:/g;
			let caseMatch: RegExpExecArray | null;
			while ((caseMatch = caseRe.exec(content)) !== null) {
				const caseName = caseMatch[1]!;
				if (caseName === 'default') {
					continue;
				}
				addEntry(entries, seen, {
					id: `ipc_${caseName}`,
					kind: 'ipc',
					label: `引擎能力: ${caseName}`,
					files: [rel],
					line: lineNumberAt(content, caseMatch.index),
				});
			}
		}

		if (rel.includes('projectOsTypes') || rel.includes('projectOsService')) {
			const methodRe = /^\s{2,}(analyze|expandNodeAnalysis|refineNode|validateGraphEdit|applyGraphEdit|getChangelog|exportChangelog|resolveNodeId|submitPrompt|scheduleReanalyze|tryLoadFromWorkspace|loadOrAnalyzeWorkspace)\s*\(/gm;
			let methodMatch: RegExpExecArray | null;
			while ((methodMatch = methodRe.exec(content)) !== null) {
				const method = methodMatch[1]!;
				addEntry(entries, seen, {
					id: `service_${method}`,
					kind: 'service',
					label: `产品能力: ${method}`,
					files: [rel],
					line: lineNumberAt(content, methodMatch.index),
				});
			}
		}
	}

	return entries;
}
