import * as fs from 'fs/promises';
import * as path from 'path';

const MAX_SNIPPET_CHARS = 500;

/** L2: lightweight static snippet — summary first, else file header + exports or line range */
export async function extractFileSnippet(
	filePath: string,
	projectRoot: string,
	existingSummary?: string,
	lineRange?: { startLine: number; endLine: number },
): Promise<string> {
	if (existingSummary?.trim()) {
		return existingSummary.trim().slice(0, MAX_SNIPPET_CHARS);
	}
	try {
		const abs = path.join(projectRoot, filePath.replace(/^\//, ''));
		const content = await fs.readFile(abs, 'utf-8');
		const lines = content.split('\n');
		if (lineRange) {
			const start = Math.max(0, lineRange.startLine - 1);
			const end = Math.min(lines.length, lineRange.endLine);
			const slice = lines.slice(start, end).join('\n');
			return slice.slice(0, MAX_SNIPPET_CHARS);
		}
		const exportLines = lines
			.filter(l => /^\s*export\s/.test(l))
			.slice(0, 8);
		if (exportLines.length > 0) {
			const snippet = [...lines.slice(0, 5), '...', ...exportLines].join('\n');
			return snippet.slice(0, MAX_SNIPPET_CHARS);
		}
		return lines.slice(0, 20).join('\n').slice(0, MAX_SNIPPET_CHARS);
	} catch {
		return '';
	}
}
