/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as fs from 'fs/promises';
import * as path from 'path';
import type { GraphChangelogEntry } from '../../../../common/projectOsTypes.js';

const CHANGELOG_FILE = 'graph-changelog.jsonl';

function changelogPath(projectPath: string): string {
	return path.join(projectPath, '.projectos', CHANGELOG_FILE);
}

export async function appendChangelog(
	projectPath: string,
	entry: GraphChangelogEntry,
): Promise<void> {
	const filePath = changelogPath(projectPath);
	await fs.mkdir(path.dirname(filePath), { recursive: true });
	await fs.appendFile(filePath, JSON.stringify(entry) + '\n', 'utf-8');
}

export async function readChangelog(
	projectPath: string,
	nodeId?: string,
): Promise<GraphChangelogEntry[]> {
	try {
		const raw = await fs.readFile(changelogPath(projectPath), 'utf-8');
		const entries = raw
			.split('\n')
			.filter(Boolean)
			.map(line => JSON.parse(line) as GraphChangelogEntry);
		if (!nodeId) {
			return entries;
		}
		return entries.filter(e => e.toId === nodeId || e.fromId === nodeId);
	} catch {
		return [];
	}
}

export async function exportChangelogText(projectPath: string): Promise<string> {
	const entries = await readChangelog(projectPath);
	if (entries.length === 0) {
		return 'No graph changelog entries.';
	}
	return entries
		.map(e => `[${e.at}] ${e.reason}: ${e.fromId ?? '(new)'} → ${e.toId}${e.note ? ` — ${e.note}` : ''}`)
		.join('\n');
}
