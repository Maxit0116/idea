/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { Emitter } from '../../../../base/common/event.js';
import { generateUuid } from '../../../../base/common/uuid.js';
import { IChannel } from '../../../../base/parts/ipc/common/ipc.js';
import { IMainProcessService } from '../../../../platform/ipc/common/mainProcessService.js';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js';
import {
	AnalysisProgress,
	GraphResponse,
	IProjectOsService,
	NodeDetailResponse,
	PROJECT_OS_CHANNEL,
	ProjectOsAnalysisState,
	ProjectOsSelection,
} from '../common/projectOsTypes.js';

class ProjectOsService extends Disposable implements IProjectOsService {
	readonly _serviceBrand: undefined;

	private readonly channel: IChannel;
	private _state: ProjectOsAnalysisState = { status: 'idle' };
	private _selection: ProjectOsSelection = { nodeId: null, detail: null };
	private activeJobId: string | null = null;

	private readonly _onDidChangeState = this._register(new Emitter<ProjectOsAnalysisState>());
	readonly onDidChangeState = this._onDidChangeState.event;

	private readonly _onDidChangeSelection = this._register(new Emitter<ProjectOsSelection>());
	readonly onDidChangeSelection = this._onDidChangeSelection.event;

	get state(): ProjectOsAnalysisState {
		return this._state;
	}

	get selection(): ProjectOsSelection {
		return this._selection;
	}

	constructor(
		@IMainProcessService mainProcessService: IMainProcessService,
	) {
		super();
		this.channel = mainProcessService.getChannel(PROJECT_OS_CHANNEL);

		this._register(this.channel.listen<{ jobId: string; code: string; message: string }>('onError')(e => {
			if (e.jobId !== this.activeJobId) {
				return;
			}
			this.setState({ status: 'error', message: e.message });
			this.activeJobId = null;
		}));

		this._register(this.channel.listen<AnalysisProgress>('onProgress')(progress => {
			if (progress.jobId !== this.activeJobId) {
				return;
			}
			this.setState({ status: 'analyzing', progress });
		}));

		this._register(this.channel.listen<{ jobId: string; projectId: string }>('onComplete')(async e => {
			if (e.jobId !== this.activeJobId) {
				return;
			}
			const graph = await this.channel.call<GraphResponse | null>('getGraph', { projectId: e.projectId });
			if (graph) {
				this.setState({ status: 'ready', graph });
			} else {
				this.setState({ status: 'error', message: '分析完成但无法加载功能地图' });
			}
			this.activeJobId = null;
		}));
	}

	async analyze(projectPath: string): Promise<void> {
		const jobId = generateUuid();
		this.activeJobId = jobId;
		this.setState({
			status: 'analyzing',
			progress: { jobId, stage: 'file_scan', percent: 0, message: '准备分析...' },
		});
		await this.channel.call('analyze', { projectPath, jobId });
	}

	async tryLoadFromWorkspace(projectPath: string): Promise<boolean> {
		const graph = await this.channel.call<GraphResponse | null>('tryLoadFromWorkspace', { projectPath });
		if (graph) {
			this.setState({ status: 'ready', graph });
			return true;
		}
		return false;
	}

	async getNodeDetail(projectId: string, nodeId: string): Promise<NodeDetailResponse | null> {
		return this.channel.call<NodeDetailResponse | null>('getNodeDetail', { projectId, nodeId });
	}

	async selectNode(projectId: string, nodeId: string): Promise<void> {
		const detail = await this.getNodeDetail(projectId, nodeId);
		this._selection = { nodeId, detail };
		this._onDidChangeSelection.fire(this._selection);
	}

	clearSelection(): void {
		this._selection = { nodeId: null, detail: null };
		this._onDidChangeSelection.fire(this._selection);
	}

	private setState(state: ProjectOsAnalysisState): void {
		this._state = state;
		if (state.status !== 'ready') {
			this.clearSelection();
		}
		this._onDidChangeState.fire(state);
	}
}

registerSingleton(IProjectOsService, ProjectOsService, InstantiationType.Delayed);
