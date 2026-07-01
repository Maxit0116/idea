/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import type { IMetricsService } from '../../../../common/metricsService.js';
import type {
	AnalysisOptions,
	AnalysisProfile,
	FunctionalEdge,
	FunctionalNode,
	ProjectOsAnalyzeLlmConfig,
	ProjectType,
} from '../../../../common/projectOsTypes.js';
import type { ScannedFile } from '../analyzer/file-scanner.js';
import type { RouteEntry } from '../../../../common/projectOsTypes.js';
import { buildFunctionTree, expandFeatureWithPass2 } from './function-tree-builder.js';

/** Back-compat wrapper — returns nodes/edges only */
export async function buildAiFunctionTree(input: {
	projectPath: string
	projectName: string
	projectType: ProjectType
	profile: AnalysisProfile
	files: ScannedFile[]
	routes: RouteEntry[]
	staticNodes?: FunctionalNode[]
	parentNode?: FunctionalNode
	packageJson?: { description?: string; name?: string } | null
	llm: ProjectOsAnalyzeLlmConfig
	metricsService: IMetricsService
	options?: AnalysisOptions
	onStage?: (stage: 'entry_discovery' | 'ai_pass1' | 'ai_pass2', message: string) => void
}): Promise<{ nodes: FunctionalNode[]; edges: FunctionalEdge[]; entryCount: number; pipeline: 'entry_driven' | 'ai_pass1' | 'ai_pass2' }> {
	return buildFunctionTree(input);
}

export async function expandNodeWithAi(input: {
	projectPath: string
	projectName: string
	projectType: ProjectType
	parentNode: FunctionalNode
	files: ScannedFile[]
	routes: RouteEntry[]
	llm: ProjectOsAnalyzeLlmConfig
	metricsService: IMetricsService
	maxUnitNodes?: number
}): Promise<{ nodes: FunctionalNode[]; edges: FunctionalEdge[] }> {
	return expandFeatureWithPass2(input);
}
