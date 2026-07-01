/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as fs from 'fs/promises';
import * as path from 'path';
import type { CodeAnchor, LinkedFile } from '../../../../common/projectOsTypes.js';

export interface AnchorValidationResult {
	valid: CodeAnchor[]
	invalid: CodeAnchor[]
	linkedFiles: LinkedFile[]
}

export async function validateAnchors(
	projectPath: string,
	anchors: CodeAnchor[],
): Promise<AnchorValidationResult> {
	const valid: CodeAnchor[] = [];
	const invalid: CodeAnchor[] = [];
	const fileMap = new Map<string, LinkedFile>();

	for (const anchor of anchors ?? []) {
		if (!anchor || typeof anchor.path !== 'string' || !anchor.path.trim()) {
			invalid.push(anchor);
			continue;
		}
		const rel = anchor.path.replace(/\\/g, '/');
		const abs = path.join(projectPath, rel);
		try {
			const content = await fs.readFile(abs, 'utf-8');
			const lineCount = content.split('\n').length;
			const start = Math.max(1, anchor.startLine);
			const end = Math.min(lineCount, Math.max(start, anchor.endLine));
			if (start > lineCount) {
				invalid.push(anchor);
				continue;
			}
			const fixed: CodeAnchor = { ...anchor, startLine: start, endLine: end };
			valid.push(fixed);
			const existing = fileMap.get(rel);
			if (!existing || roleRank(fixed.role) < roleRank(existing.role)) {
				fileMap.set(rel, { path: rel, role: fixed.role, summary: fixed.summary });
			}
		} catch {
			invalid.push(anchor);
		}
	}

	return {
		valid,
		invalid,
		linkedFiles: Array.from(fileMap.values()),
	};
}

function roleRank(role: LinkedFile['role']): number {
	const order: LinkedFile['role'][] = ['primary', 'core', 'api', 'supporting', 'config', 'test'];
	const idx = order.indexOf(role);
	return idx >= 0 ? idx : order.length;
}

export function anchorsOverlap(a: CodeAnchor, b: CodeAnchor): boolean {
	if (a.path !== b.path) {
		return false;
	}
	return a.startLine <= b.endLine && b.startLine <= a.endLine;
}
