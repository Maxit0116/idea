/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import type { ScannedFile } from '../analyzer/file-scanner.js';

export interface SymbolOutline {
	path: string
	exports: string[]
	functions: { name: string; line: number }[]
	classes: { name: string; line: number }[]
}

const EXPORT_RE = /^\s*export\s+(?:async\s+)?(?:function|class|const|let|var|interface|type|enum)\s+(\w+)/;
const FUNC_RE = /^\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)/;
const CLASS_RE = /^\s*(?:export\s+)?class\s+(\w+)/;
const ARROW_EXPORT_RE = /^\s*export\s+const\s+(\w+)\s*=/;

export function buildSymbolOutline(file: ScannedFile): SymbolOutline | null {
	if (!file.content) {
		return null;
	}
	const lines = file.content.split('\n');
	const outline: SymbolOutline = {
		path: file.relativePath.replace(/\\/g, '/'),
		exports: [],
		functions: [],
		classes: [],
	};

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i]!;
		const lineNum = i + 1;
		let m = EXPORT_RE.exec(line) ?? ARROW_EXPORT_RE.exec(line);
		if (m) {
			outline.exports.push(m[1]!);
		}
		m = FUNC_RE.exec(line);
		if (m) {
			outline.functions.push({ name: m[1]!, line: lineNum });
		}
		m = CLASS_RE.exec(line);
		if (m) {
			outline.classes.push({ name: m[1]!, line: lineNum });
		}
	}

	if (outline.exports.length === 0 && outline.functions.length === 0 && outline.classes.length === 0) {
		return null;
	}
	return outline;
}

export function buildProjectOutline(files: ScannedFile[], limit = 120): SymbolOutline[] {
	const out: SymbolOutline[] = [];
	for (const file of files) {
		if (out.length >= limit) {
			break;
		}
		if (!/\.(tsx?|jsx?|vue|svelte)$/.test(file.relativePath)) {
			continue;
		}
		const o = buildSymbolOutline(file);
		if (o) {
			out.push(o);
		}
	}
	return out;
}
