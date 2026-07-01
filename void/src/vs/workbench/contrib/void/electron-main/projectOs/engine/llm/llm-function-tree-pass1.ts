/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import type { IMetricsService } from '../../../../common/metricsService.js';
import type {
	AnalysisProfile,
	AnchorSymbolKind,
	EdgeRelation,
	ProjectOsAnalyzeLlmConfig,
	ProjectType,
} from '../../../../common/projectOsTypes.js';
import type { EntryPoint } from '../analyzer/entry-discovery.js';
import { extractJsonPayload } from './llm-json-extract.js';
import { normalizeLlmFunctionTreeNodes } from './llm-node-normalize.js';
import { filterDirectoryMirrorNodes } from './llm-tree-quality.js';
import { sendLlmChatPromise } from './send-llm-promise.js';

export interface LlmFunctionTreeNode {
	slug: string
	name: string
	nameEn: string
	granularity: 'module' | 'feature' | 'subfeature' | 'unit'
	parentSlug: string | null
	summary: string
	description: string
	tags?: string[]
	anchors: {
		path: string
		startLine: number
		endLine: number
		symbolName?: string
		symbolKind?: AnchorSymbolKind
		role: 'primary' | 'core' | 'api' | 'supporting' | 'config' | 'test'
		summary?: string
	}[]
}

export interface LlmFunctionTreeEdge {
	sourceSlug: string
	targetSlug: string
	relation: EdgeRelation
	confidence?: number
	evidence?: string
}

export interface LlmFunctionTreeResponse {
	nodes: LlmFunctionTreeNode[]
	edges?: LlmFunctionTreeEdge[]
}

const PASS1_SYSTEM_PROMPT = `You are a senior product architect. Build a FUNCTION MAP that a non-technical user can read.

AUDIENCE: End users and product managers — NOT developers. Never name nodes after folders, platforms, or tech stacks.

CRITICAL RULES:
- Node "name" MUST be user-visible capability in Chinese (e.g. 习惯打卡, 奖励兑换, 查看对方动态)
- Node "nameEn" MUST be plain English product language (e.g. Habit Check-in, Reward Redemption)
- NEVER use: Android, iOS, macOS, shared, gradle, src, mod_*, folder names, or file paths as node names
- Use entryPoints and productFeatures as PRIMARY sources — each major entry should become a feature or subfeature
- Build a tree with parentSlug links: project → features → subfeatures → units (target depth ≥ 3 for apps)
- Produce 12–30 nodes for typical apps; every README product feature must appear as a node
- "summary": one sentence a user would understand; "description": 2–3 sentences about user value (no file names)
- granularity: module | feature | subfeature | unit — use unit for distinct screens/flows
- anchors MUST reference real source files from entryPoints or symbolOutline
- Only feature-level edges: depends_on, redirects_to, data_flows_to, shares_data (NOT imports)
- Respond with ONLY valid JSON, no markdown fences, no thinking tags`;

function extractJson(text: string | null | undefined): LlmFunctionTreeResponse {
	const parsed = extractJsonPayload<LlmFunctionTreeResponse>(text, 'Pass1');
	if (!parsed?.nodes || !Array.isArray(parsed.nodes)) {
		throw new Error('LLM Pass1 response missing nodes array');
	}
	return {
		...parsed,
		nodes: filterDirectoryMirrorNodes(normalizeLlmFunctionTreeNodes(parsed.nodes)),
	};
}

export async function requestFunctionTreePass1(input: {
	projectName: string
	projectType: ProjectType
	profile: AnalysisProfile
	entryPoints: EntryPoint[]
	readmeExcerpt?: string
	packageDescription?: string
	productFeatures?: string[]
	routes: { path: string; file: string }[]
	outlineSample: object[]
	compactPayload?: boolean
	llm: ProjectOsAnalyzeLlmConfig
	metricsService: IMetricsService
}): Promise<LlmFunctionTreeResponse> {
	const depthHint = input.profile === 'deep'
		? 'Include subfeatures AND unit nodes for screens, sync flows, and data operations. Target depth 4.'
		: 'Produce features → subfeatures → units (screens/tabs). Target depth ≥ 3. Group Android/macOS as implementation under product features, NOT as top-level nodes.';

	const entryLimit = input.compactPayload
		? Math.min(15, input.entryPoints.length)
		: (input.entryPoints.length > 25 ? 20 : 35)
	const outlineLimit = input.compactPayload ? 15 : (input.outlineSample.length > 40 ? 25 : 45)

	const entryPayload = input.entryPoints.slice(0, entryLimit).map(e => ({
		id: e.id,
		kind: e.kind,
		label: e.label,
		files: e.files.slice(0, 3),
		line: e.line,
		preview: e.preview?.split('\n').slice(0, 12).join('\n'),
		exports: e.exports?.slice(0, 5),
	}));

	const userPrompt = JSON.stringify({
		projectName: input.projectName,
		projectType: input.projectType,
		instruction: depthHint,
		productFeatures: input.productFeatures?.slice(0, 12),
		readmeExcerpt: input.readmeExcerpt?.slice(0, 2500),
		packageDescription: input.packageDescription,
		entryPoints: entryPayload,
		routes: input.routes.slice(0, 25),
		symbolOutline: input.outlineSample.slice(0, outlineLimit),
		outputSchema: {
			nodes: '[{ slug, name, nameEn, granularity, parentSlug, summary, description, tags?, anchors[] }]',
			edges: '[{ sourceSlug, targetSlug, relation, confidence?, evidence? }]',
		},
	}, null, 2);

	const raw = await sendLlmChatPromise({
		messages: [{ role: 'user', content: userPrompt }],
		separateSystemMessage: PASS1_SYSTEM_PROMPT,
		modelSelection: input.llm.modelSelection,
		settingsOfProvider: input.llm.settingsOfProvider,
		modelSelectionOptions: input.llm.modelSelectionOptions,
		overridesOfModel: input.llm.overridesOfModel,
		chatMode: 'normal',
		loggingName: 'Function Map AI Pass1',
		metricsService: input.metricsService,
	});

	return extractJson(raw);
}
