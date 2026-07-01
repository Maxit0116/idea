/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import type { IMetricsService } from '../../../../common/metricsService.js';
import type {
	GraphEdit,
	GuardAlternative,
	ProjectGraph,
	ProjectOsAnalyzeLlmConfig,
	ValidateEditResponse,
} from '../../../../common/projectOsTypes.js';
import { sendLlmChatPromise } from './send-llm-promise.js';

const SYSTEM_PROMPT = `You are an architecture guard for a function map. Evaluate whether a proposed graph edit is safe.

P0 critical (usually block): merge, delete, reparent
Rename: usually warning only

Respond with JSON only:
{
  "allowed": boolean,
  "severity": "ok" | "warning" | "critical",
  "impacts": ["..."],
  "alternatives": [{ "label": "...", "description": "...", "patch": { "type": "...", "nodeId": "...", ... } }]
}`

function extractJson(text: string): ValidateEditResponse {
	const trimmed = text.trim();
	const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
	const jsonStr = fenceMatch ? fenceMatch[1]!.trim() : trimmed;
	return JSON.parse(jsonStr) as ValidateEditResponse;
}

export async function validateEditWithLlm(input: {
	graph: ProjectGraph
	edit: GraphEdit
	llm: ProjectOsAnalyzeLlmConfig
	metricsService: IMetricsService
}): Promise<ValidateEditResponse> {
	const { graph, edit, llm, metricsService } = input;
	const node = graph.nodes.find(n => n.id === edit.nodeId);
	const subtree = graph.nodes
		.filter(n => n.parentId === edit.nodeId || n.id === edit.nodeId)
		.map(n => ({ id: n.id, name: n.name, granularity: n.granularity, childCount: n.children.length }));

	const userPrompt = JSON.stringify({
		edit,
		node: node ? { id: node.id, name: node.name, granularity: node.granularity } : null,
		subtree,
		projectName: graph.projectName,
	}, null, 2);

	try {
		const raw = await sendLlmChatPromise({
			messages: [{ role: 'user', content: userPrompt }],
			separateSystemMessage: SYSTEM_PROMPT,
			modelSelection: llm.modelSelection,
			settingsOfProvider: llm.settingsOfProvider,
			modelSelectionOptions: llm.modelSelectionOptions,
			overridesOfModel: llm.overridesOfModel,
			chatMode: 'normal',
			loggingName: 'Architecture Guard',
			metricsService,
		});
		return extractJson(raw);
	} catch {
		return {
			allowed: edit.type === 'rename',
			severity: edit.type === 'rename' ? 'warning' : 'critical',
			impacts: ['AI guard unavailable — apply local rules only'],
			alternatives: [],
		};
	}
}

export async function refineNodeWithLlm(input: {
	graph: ProjectGraph
	nodeId: string
	llm: ProjectOsAnalyzeLlmConfig
	metricsService: IMetricsService
}): Promise<GuardAlternative[]> {
	const { graph, nodeId, llm, metricsService } = input;
	const node = graph.nodes.find(n => n.id === nodeId);
	if (!node) {
		return [];
	}
	const children = graph.nodes.filter(n => n.parentId === nodeId);

	const userPrompt = JSON.stringify({
		instruction: 'Suggest 2-3 fixes for this function map subtree. Return JSON: { "alternatives": [...] }',
		node: { id: node.id, name: node.name, summary: node.summary, granularity: node.granularity },
		children: children.map(c => ({ id: c.id, name: c.name, granularity: c.granularity })),
	}, null, 2);

	try {
		const raw = await sendLlmChatPromise({
			messages: [{ role: 'user', content: userPrompt }],
			separateSystemMessage: SYSTEM_PROMPT + '\nFocus on merge, reparent, rename, or anchor fixes for the subtree.',
			modelSelection: llm.modelSelection,
			settingsOfProvider: llm.settingsOfProvider,
			modelSelectionOptions: llm.modelSelectionOptions,
			overridesOfModel: llm.overridesOfModel,
			chatMode: 'normal',
			loggingName: 'Node Refine',
			metricsService,
		});
		const parsed = extractJson(raw) as unknown as { alternatives: GuardAlternative[] };
		return parsed.alternatives ?? [];
	} catch {
		return [];
	}
}
