import type { IMetricsService } from '../../../../common/metricsService.js'
import type { ProjectOsAnalyzeLlmConfig } from '../../../../common/projectOsTypes.js'
import type { FunctionalEdge, FunctionalNode, ProjectType } from '../../../../common/projectOsTypes.js'
import type { EdgeRelation } from '../../../../common/projectOsTypes.js'
import { sendLlmChatPromise } from './send-llm-promise.js'

interface LlmNodePatch {
	id: string
	name: string
	nameEn: string
	summary: string
	description: string
	tags?: string[]
}

interface LlmEdgePatch {
	source: string
	target: string
	relation: EdgeRelation
	evidence?: string
}

interface LlmArchitectureResponse {
	nodes: LlmNodePatch[]
	edges?: LlmEdgePatch[]
}

const SYSTEM_PROMPT = `You are a senior product architect helping non-technical founders understand their codebase.

Given static analysis clusters from a software project, produce a FUNCTION MAP in product language (not file names).

Rules:
- Use concise Chinese names for "name" (e.g. 用户登录, 订单管理) and English for "nameEn"
- "summary" is one sentence for end users
- "description" is 2-3 sentences explaining what the feature does
- Keep existing node "id" values unchanged
- Only add edges that represent real user-visible feature relationships
- relation must be one of: depends_on, redirects_to, data_flows_to, imports, shares_data
- Respond with ONLY valid JSON, no markdown fences`

function buildUserPrompt(
	projectName: string,
	projectType: ProjectType,
	nodes: FunctionalNode[],
	edges: FunctionalEdge[],
): string {
	const nodeSummaries = nodes
		.filter(n => n.id !== 'sys_root')
		.slice(0, 40)
		.map(n => ({
			id: n.id,
			currentName: n.name,
			nameEn: n.nameEn,
			tags: n.tags,
			fileCount: n.linkedFiles.length,
			sampleFiles: n.linkedFiles.slice(0, 5).map(f => f.path),
		}))

	const edgeSummaries = edges.slice(0, 60).map(e => ({
		source: e.source,
		target: e.target,
		relation: e.relation,
	}))

	return JSON.stringify({
		projectName,
		projectType,
		instruction: 'Return JSON: { "nodes": [...], "edges": [...] }',
		staticClusters: nodeSummaries,
		staticEdges: edgeSummaries,
	}, null, 2)
}

function extractJson(text: string): LlmArchitectureResponse {
	const trimmed = text.trim()
	const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
	const jsonStr = fenceMatch ? fenceMatch[1].trim() : trimmed
	const parsed = JSON.parse(jsonStr) as LlmArchitectureResponse
	if (!parsed?.nodes || !Array.isArray(parsed.nodes)) {
		throw new Error('LLM response missing nodes array')
	}
	return parsed
}

export async function enrichArchitectureWithLlm(input: {
	projectName: string
	projectType: ProjectType
	nodes: FunctionalNode[]
	edges: FunctionalEdge[]
	llm: ProjectOsAnalyzeLlmConfig
	metricsService: IMetricsService
}): Promise<{ nodes: FunctionalNode[]; edges: FunctionalEdge[] }> {
	const { projectName, projectType, nodes, edges, llm, metricsService } = input

	const userPrompt = buildUserPrompt(projectName, projectType, nodes, edges)

	const raw = await sendLlmChatPromise({
		messages: [{ role: 'user', content: userPrompt }],
		separateSystemMessage: SYSTEM_PROMPT,
		modelSelection: llm.modelSelection,
		settingsOfProvider: llm.settingsOfProvider,
		modelSelectionOptions: llm.modelSelectionOptions,
		overridesOfModel: llm.overridesOfModel,
		chatMode: 'normal',
		loggingName: 'Function Map LLM Enrichment',
		metricsService,
	})

	const parsed = extractJson(raw)
	const patchById = new Map(parsed.nodes.map(p => [p.id, p]))

	const enrichedNodes = nodes.map(node => {
		const patch = patchById.get(node.id)
		if (!patch) {
			return node
		}
		return {
			...node,
			name: patch.name || node.name,
			nameEn: patch.nameEn || node.nameEn,
			summary: patch.summary || node.summary,
			description: patch.description || node.description,
			tags: patch.tags?.length ? patch.tags : node.tags,
			confidence: Math.min(0.98, node.confidence + 0.1),
		}
	})

	const existingEdgeKeys = new Set(edges.map(e => `${e.source}|${e.target}|${e.relation}`))
	const extraEdges: FunctionalEdge[] = []
	for (const e of parsed.edges ?? []) {
		const key = `${e.source}|${e.target}|${e.relation}`
		if (existingEdgeKeys.has(key)) {
			continue
		}
		if (!nodes.some(n => n.id === e.source) || !nodes.some(n => n.id === e.target)) {
			continue
		}
		existingEdgeKeys.add(key)
		extraEdges.push({
			id: `llm_${e.source}_${e.target}_${e.relation}`,
			source: e.source,
			target: e.target,
			relation: e.relation,
			confidence: 0.65,
			evidence: e.evidence ?? 'LLM inferred',
		})
	}

	return {
		nodes: enrichedNodes,
		edges: [...edges, ...extraEdges],
	}
}
