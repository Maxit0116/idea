/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

const THINK_OPEN = String.fromCharCode(60) + 'think' + String.fromCharCode(62)
const THINK_CLOSE = String.fromCharCode(60) + '/' + 'think' + String.fromCharCode(62)
const THINK_BLOCK_RE = new RegExp(THINK_OPEN + '[\\s\\S]*?' + THINK_CLOSE, 'gi')
const REDACTED_THINKING_RE = /<think>[\s\S]*?<\/redacted_thinking>/gi

/** Strip thinking blocks and markdown fences; isolate JSON object from LLM output. */
export function extractJsonPayload<T>(text: string | null | undefined, label: string): T {
	if (typeof text !== 'string' || !text.trim()) {
		throw new Error(`LLM ${label} response is empty`)
	}
	const trimmed = text.trim()
	const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
	let jsonStr = fenceMatch ? fenceMatch[1]!.trim() : trimmed

	jsonStr = jsonStr.replace(THINK_BLOCK_RE, '').replace(REDACTED_THINKING_RE, '').trim()

	if (!jsonStr.startsWith('{') && !jsonStr.startsWith('[')) {
		const objStart = jsonStr.indexOf('{')
		const objEnd = jsonStr.lastIndexOf('}')
		if (objStart !== -1 && objEnd > objStart) {
			jsonStr = jsonStr.slice(objStart, objEnd + 1)
		}
	}

	const parsed = JSON.parse(jsonStr) as T
	if (!parsed || typeof parsed !== 'object') {
		throw new Error(`LLM ${label} response is not valid JSON`)
	}
	return parsed
}
