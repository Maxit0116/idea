/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as fs from 'fs/promises';
import * as path from 'path';
import { IServerChannel } from '../../../../base/parts/ipc/common/ipc.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { analyzeProject } from './projectOs/engine/graph/builder.js';
import { enrichTopology } from './projectOs/engine/graph/topology-hierarchy.js';
import { renderTopologyMarkdown } from './projectOs/engine/graph/topology-render.js';
import { FileMemoryStore } from './projectOs/engine/memory/memory-store.js';
import { createJob, updateJob, completeJob, failJob } from './projectOs/engine/jobs/index.js';
import type {
	AnalysisProgress,
	GraphResponse,
	NodeDetailResponse,
	ProjectGraph,
} from '../common/projectOsTypes.js';

export class ProjectOsChannel implements IServerChannel {

	private readonly graphs = new Map<string, ProjectGraph>();
	private readonly projectPaths = new Map<string, string>();
	private memoryStore: FileMemoryStore | null = null;

	private readonly progressEmitter = new Emitter<AnalysisProgress>();
	private readonly completeEmitter = new Emitter<{ jobId: string; projectId: string }>();
	private readonly errorEmitter = new Emitter<{ jobId: string; code: string; message: string }>();

	listen(_: unknown, event: string): Event<any> {
		if (event === 'onProgress') {
			return this.progressEmitter.event;
		}
		if (event === 'onComplete') {
			return this.completeEmitter.event;
		}
		if (event === 'onError') {
			return this.errorEmitter.event;
		}
		throw new Error(`ProjectOsChannel event not found: ${event}`);
	}

	async call(_: unknown, command: string, params: any): Promise<any> {
		switch (command) {
			case 'analyze':
				return this.analyze(params.projectPath, params.jobId);
			case 'getGraph':
				return this.getGraph(params.projectId);
			case 'getNodeDetail':
				return this.getNodeDetail(params.projectId, params.nodeId);
			case 'tryLoadFromWorkspace':
				return this.tryLoadFromWorkspace(params.projectPath);
			case 'getTopologyMarkdown':
				return this.getTopologyMarkdown(params.projectId, params.focusNodeId);
			default:
				throw new Error(`ProjectOsChannel command not found: ${command}`);
		}
	}

	private async analyze(projectPath: string, jobId: string): Promise<{ success: boolean; jobId: string }> {
		createJob(jobId);

		analyzeProject(projectPath, jobId, {
			onProgress: (progress: AnalysisProgress) => {
				updateJob(jobId, {
					status: 'analyzing',
					progress: progress.percent,
					stage: progress.stage,
				});
				this.progressEmitter.fire(progress);
			},
			onComplete: async (graph: ProjectGraph) => {
				this.graphs.set(graph.projectId, graph);
				this.projectPaths.set(graph.projectId, projectPath);
				// Stello-inspired memory: persist project-level topology summary
				const memPath = path.join(projectPath, '.projectos', 'memory.json');
				this.memoryStore = new FileMemoryStore(memPath);
				await this.memoryStore.load();
				const topologyMd = renderTopologyMarkdown(graph, { includeFiles: true });
				await this.memoryStore.upsert(
					'architecture-topology',
					topologyMd,
					'project',
					null,
				);
				completeJob(jobId);
				this.completeEmitter.fire({ jobId, projectId: graph.projectId });
			},
			onError: (error: Error) => {
				failJob(jobId, error.message);
				this.errorEmitter.fire({
					jobId,
					code: 'ANALYSIS_FAILED',
					message: error.message,
				});
			},
		});

		return { success: true, jobId };
	}

	private getGraph(projectId: string): GraphResponse | null {
		const graph = this.graphs.get(projectId);
		if (!graph) {
			return null;
		}
		const projectPath = this.projectPaths.get(projectId) ?? '';
		return {
			projectId: graph.projectId,
			projectName: graph.projectName,
			projectType: graph.projectType,
			analysisStatus: graph.analysisStatus,
			projectPath,
			nodes: graph.nodes,
			edges: graph.edges,
		};
	}

	private getNodeDetail(projectId: string, nodeId: string): NodeDetailResponse | null {
		const graph = this.graphs.get(projectId);
		if (!graph) {
			return null;
		}
		const node = graph.nodes.find(n => n.id === nodeId);
		if (!node) {
			return null;
		}
		return {
			id: node.id,
			name: node.name,
			nameEn: node.nameEn,
			status: node.status,
			description: node.description,
			summary: node.summary,
			files: node.linkedFiles,
			upstream: node.upstream
				.map(id => graph.nodes.find(n => n.id === id))
				.filter(Boolean)
				.map(n => ({ id: n!.id, name: n!.name })),
			downstream: node.downstream
				.map(id => graph.nodes.find(n => n.id === id))
				.filter(Boolean)
				.map(n => ({ id: n!.id, name: n!.name })),
			preview: node.preview,
			tags: node.tags,
		};
	}

	private async tryLoadFromWorkspace(projectPath: string): Promise<GraphResponse | null> {
		const graphPath = path.join(projectPath, '.projectos', 'graph.json');
		try {
			const raw = await fs.readFile(graphPath, 'utf-8');
			let graph = JSON.parse(raw) as ProjectGraph;
			// Re-enrich cached graphs that predate Stello topology (no sys_root)
			if (!graph.nodes.some(n => n.id === 'sys_root')) {
				graph = {
					...graph,
					nodes: enrichTopology(graph.nodes, graph.edges),
				};
			}
			this.graphs.set(graph.projectId, graph);
			this.projectPaths.set(graph.projectId, projectPath);
			return {
				projectId: graph.projectId,
				projectName: graph.projectName,
				projectType: graph.projectType,
				analysisStatus: graph.analysisStatus,
				projectPath,
				nodes: graph.nodes,
				edges: graph.edges,
			};
		} catch {
			return null;
		}
	}

	private getTopologyMarkdown(projectId: string, focusNodeId?: string): string {
		const graph = this.graphs.get(projectId);
		if (!graph) {
			return '';
		}
		return renderTopologyMarkdown(graph, { focusNodeId, includeFiles: !!focusNodeId });
	}
}
