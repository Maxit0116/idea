/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

/** Turn raw LLM / provider errors into actionable user-facing text (Chinese). */
export function formatLlmErrorForUser(raw: string): string {
	const m = raw.trim()
	if (!m) {
		return 'AI 分析失败，原因未知。'
	}

	if (/429|rate limit|quota|RESOURCE_EXHAUSTED/i.test(m)) {
		const retry = m.match(/retry in ([\d.]+)s/i)?.[1]
		const waitHint = retry ? `约 ${Math.ceil(parseFloat(retry))} 秒后可重试。` : '请稍后再试。'
		return `Gemini API 配额/速率已用尽（Key 有效，但免费额度为 0 或已耗尽）。${waitHint}可在 Google AI Studio 检查用量，或换用 gemini-2.0-flash-lite / 开通计费。`
	}

	if (/400.*parts\[0\].*data|INVALID_ARGUMENT/i.test(m)) {
		return 'AI 请求格式错误。请重启 IDE 后重试；若仍失败请换用 OpenAI/Anthropic 模型。'
	}

	if (/API key|apiKey|401|403|invalid.*key/i.test(m)) {
		return 'API Key 无效或未配置。请在 Settings → Gemini 填入 AI Studio 生成的 Key（通常以 AIzaSy 开头）。'
	}

	if (/fetch failed|ECONNREFUSED|network/i.test(m)) {
		return '无法连接模型服务，请检查网络或代理设置。'
	}

	if (/超时|timeout/i.test(m)) {
		return 'AI 分析超时。可换更小模型或缩小项目后重试。'
	}

	const firstLine = m.split('\n')[0] ?? m
	return firstLine.length > 280 ? `${firstLine.slice(0, 277)}…` : firstLine
}

export function formatAnalysisErrorForUser(analysisError: string | null | undefined): string {
	if (!analysisError) {
		return '功能地图 AI 分析未完成，当前仍为技术模块聚类。'
	}
	const stripped = analysisError.replace(/^AI 功能树失败:\s*/i, '')
	return `功能地图 AI 分析未完成：${formatLlmErrorForUser(stripped)}`
}
