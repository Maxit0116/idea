/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import type { IMetricsService } from '../../../../common/metricsService.js';
import type { ProjectOsAnalyzeLlmConfig } from '../../../../common/projectOsTypes.js';
import type { LlmFunctionTreeNode, LlmFunctionTreeResponse } from './llm-function-tree-pass1.js';
import { extractJsonPayload } from './llm-json-extract.js';
import { normalizeLlmFunctionTreeNodes } from './llm-node-normalize.js';
import { sendLlmChatPromise } from './send-llm-promise.js';

const PASS2_SYSTEM_PROMPT = `You refine ONE parent product feature into subfeatures and user-visible units.

AUDIENCE: Non-technical users. Describe what people DO in the app, not code structure.

Rules:
- parentSlug MUST be the given parent feature slug
- Add subfeatures/units under the parent only — do not repeat top-level features
- Use product language: 习惯打卡, 奖励兑换, 查看对方动态 — never folder/platform names
- Each screen/tab/flow should become a unit node with granularity "unit"
- summary/description: user value in plain Chinese; nameEn in plain English
- anchors must reference files from linkedFilesSummary with plausible line ranges
- Respond with ONLY valid JSON: { nodes: [...] }`;

function extractJson(text: string | null | undefined): LlmFunctionTreeResponse {
	const parsed = extractJsonPayload<LlmFunctionTreeResponse>(text, 'Pass2');
	if (!parsed?.nodes || !Array.isArray(parsed.nodes)) {
		throw new Error('LLM Pass2 response missing nodes array');
	}
	return {
		...parsed,
		nodes: normalizeLlmFunctionTreeNodes(parsed.nodes),
	};
}

export async function requestFunctionTreePass2(input: {
	parentSlug: string
	parentName: string
	linkedFilesSummary: { path: string; excerpt: string; exports?: string[] }[]
	outlineForFeature: object[]
	maxNodes: number
	llm: ProjectOsAnalyzeLlmConfig
	metricsService: IMetricsService
}): Promise<LlmFunctionTreeNode[]> {
	const userPrompt = JSON.stringify({
		parentSlug: input.parentSlug,
		parentName: input.parentName,
		maxNodes: input.maxNodes,
		linkedFilesSummary: input.linkedFilesSummary.slice(0, 15),
		symbolOutline: input.outlineForFeature.slice(0, 40),
		outputSchema: {
			nodes: '[{ slug, name, nameEn, granularity, parentSlug, summary, description, tags?, anchors[] }]',
		},
	}, null, 2);

	const raw = await sendLlmChatPromise({
		messages: [{ role: 'user', content: userPrompt }],
		separateSystemMessage: PASS2_SYSTEM_PROMPT,
		modelSelection: input.llm.modelSelection,
		settingsOfProvider: input.llm.settingsOfProvider,
		modelSelectionOptions: input.llm.modelSelectionOptions,
		overridesOfModel: input.llm.overridesOfModel,
		chatMode: 'normal',
		loggingName: 'Function Map AI Pass2',
		metricsService: input.metricsService,
	});

	return extractJson(raw).nodes.slice(0, input.maxNodes);
}
