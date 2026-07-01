/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { Emitter } from '../../../../base/common/event.js';
import { generateUuid } from '../../../../base/common/uuid.js';
import { IChannel } from '../../../../base/parts/ipc/common/ipc.js';
import { IMainProcessService } from '../../../../platform/ipc/common/mainProcessService.js';
import { INotificationService, Severity } from '../../../../platform/notification/common/notification.js';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js';
import {
	AnalysisOptions,
	AnalysisProgress,
	AnalysisProfile,
	ApplyGraphEditResponse,
	DEFAULT_ANALYSIS_OPTIONS,
	GraphChangelogEntry,
	GraphEdit,
	GraphResponse,
	IProjectOsService,
	NodeDetailResponse,
	PROJECT_OS_CHANNEL,
	ProjectDetailResponse,
	ProjectOsAnalysisState,
	ProjectOsAnalyzeLlmConfig,
	ProjectOsChatContext,
	ProjectOsSelection,
	RefineNodeResponse,
	SelectNodeContextResponse,
	SubmitPromptResponse,
	ValidateEditResponse,
} from '../common/projectOsTypes.js';
import { formatAnalysisErrorForUser } from '../common/llmErrorFormat.js';
import { IVoidSettingsService } from '../common/voidSettingsService.js';
import { isProviderReadyForModelOptions, ModelSelection } from '../common/voidSettingsTypes.js';

const SYS_ROOT_ID = 'sys_root';

class ProjectOsService extends Disposable implements IProjectOsService {
	readonly _serviceBrand: undefined;

	private readonly channel: IChannel;
	private _state: ProjectOsAnalysisState = { status: 'idle' };
	private _selection: ProjectOsSelection = {
		nodeId: null,
		level: 'none',
		detail: null,
		projectDetail: null,
	};
	private _chatContext: ProjectOsChatContext | null = null;
	private _expandedNodeIds = new Set<string>();
	private _focusNodeId: string | null = null;
	private activeJobId: string | null = null;
	private reanalyzeJobId: string | null = null;
	private lastWorkspacePath: string | null = null;
	private lastAnalysisModelKey: string | null = null;

	private readonly _onDidChangeState = this._register(new Emitter<ProjectOsAnalysisState>());
	readonly onDidChangeState = this._onDidChangeState.event;

	private readonly _onDidChangeSelection = this._register(new Emitter<ProjectOsSelection>());
	readonly onDidChangeSelection = this._onDidChangeSelection.event;

	private readonly _onDidChangeChatContext = this._register(new Emitter<ProjectOsChatContext | null>());
	readonly onDidChangeChatContext = this._onDidChangeChatContext.event;

	private readonly _onDidChangeExpandedNodes = this._register(new Emitter<ReadonlySet<string>>());
	readonly onDidChangeExpandedNodes = this._onDidChangeExpandedNodes.event;

	private readonly _onDidChangeFocusNode = this._register(new Emitter<string | null>());
	readonly onDidChangeFocusNode = this._onDidChangeFocusNode.event;

	get state(): ProjectOsAnalysisState {
		return this._state;
	}

	get selection(): ProjectOsSelection {
		return this._selection;
	}

	get chatContext(): ProjectOsChatContext | null {
		return this._chatContext;
	}

	get expandedNodeIds(): ReadonlySet<string> {
		return this._expandedNodeIds;
	}

	get focusNodeId(): string | null {
		return this._focusNodeId;
	}

	constructor(
		@IMainProcessService mainProcessService: IMainProcessService,
		@IVoidSettingsService private readonly voidSettingsService: IVoidSettingsService,
		@INotificationService private readonly notificationService: INotificationService,
	) {
		super();
		this.channel = mainProcessService.getChannel(PROJECT_OS_CHANNEL);

		this._register(this.channel.listen<{ jobId: string; code: string; message: string }>('onError')(e => {
			if (e.jobId !== this.activeJobId && e.jobId !== this.reanalyzeJobId) {
				return;
			}
			if (e.jobId === this.reanalyzeJobId) {
				this.reanalyzeJobId = null;
				this.notificationService.notify({
					severity: Severity.Warning,
					message: `功能地图同步失败: ${e.message}`,
				});
				return;
			}
			this.setState({ status: 'error', message: e.message });
			this.activeJobId = null;
		}));

		this._register(this.channel.listen<AnalysisProgress>('onProgress')(progress => {
			if (progress.jobId !== this.activeJobId && progress.jobId !== this.reanalyzeJobId) {
				return;
			}
			if (progress.jobId === this.reanalyzeJobId) {
				return;
			}
			this.setState({ status: 'analyzing', progress });
		}));

		this._register(this.channel.listen<{ jobId: string; projectId: string }>('onComplete')(async e => {
			const isReanalyze = e.jobId === this.reanalyzeJobId;
			if (e.jobId !== this.activeJobId && !isReanalyze) {
				return;
			}
			const graph = await this.channel.call<GraphResponse | null>('getGraph', { projectId: e.projectId });
			if (graph) {
				const prevSelectionId = this._selection.nodeId;
				this.setState({ status: 'ready', graph }, { preserveSelection: isReanalyze });
				if (graph.analysisStatus === 'partial') {
					this.notificationService.notify({
						severity: Severity.Warning,
						message: formatAnalysisErrorForUser(graph.analysisError),
					});
				} else if (!isReanalyze && graph.version === '0.3.0' && graph.nodes.some(n => n.id.startsWith('feat_'))) {
					this.notificationService.notify({
						severity: Severity.Info,
						message: 'AI 功能树分析完成',
					});
				}
				if (isReanalyze) {
					this.reanalyzeJobId = null;
					this.notificationService.notify({
						severity: Severity.Info,
						message: '功能地图已同步最新结构',
					});
					if (prevSelectionId) {
						if (prevSelectionId === SYS_ROOT_ID) {
							await this.selectProject(graph.projectId);
						} else {
							await this.selectNode(graph.projectId, prevSelectionId);
						}
					}
				}
			} else if (!isReanalyze) {
				this.setState({ status: 'error', message: '分析完成但无法加载功能地图' });
			}
			if (e.jobId === this.activeJobId) {
				this.activeJobId = null;
			}
		}));

		this._register(this.voidSettingsService.onDidChangeState(() => {
			this.onAnalysisModelSettingsChanged();
		}));
	}

	private modelSelectionKey(): string | null {
		const m = this.resolveAnalysisModel();
		return m ? `${m.providerName}:${m.modelName}` : null;
	}

	private onAnalysisModelSettingsChanged(): void {
		const key = this.modelSelectionKey();
		if (this.lastAnalysisModelKey === null) {
			this.lastAnalysisModelKey = key;
			return;
		}
		if (key === this.lastAnalysisModelKey) {
			return;
		}
		this.lastAnalysisModelKey = key;
		if (this._state.status !== 'ready' || !this.lastWorkspacePath) {
			return;
		}
		this.notificationService.prompt(
			Severity.Info,
			'分析模型已更改，是否重新分析项目以更新功能地图？',
			[{
				label: '重新分析',
				run: () => {
					void this.analyze(this.lastWorkspacePath!);
				},
			}],
		);
	}

	private resolveAnalysisModel(): ModelSelection | null {
		const state = this.voidSettingsService.state;
		if (state.globalSettings.functionMapUseChatModel) {
			return state.modelSelectionOfFeature.Chat;
		}
		return state.modelSelectionOfFeature.FunctionMap ?? state.modelSelectionOfFeature.Chat;
	}

	private buildLlmConfig(): ProjectOsAnalyzeLlmConfig | undefined {
		const state = this.voidSettingsService.state;
		const modelSelection = this.resolveAnalysisModel();
		if (!modelSelection) {
			return undefined;
		}
		if (!isProviderReadyForModelOptions(modelSelection.providerName, state)) {
			return undefined;
		}
		const featureForOptions = state.globalSettings.functionMapUseChatModel ? 'Chat' : 'FunctionMap';
		const modelSelectionOptions = state.optionsOfModelSelection[featureForOptions]?.[modelSelection.providerName]?.[modelSelection.modelName];
		return {
			modelSelection,
			settingsOfProvider: state.settingsOfProvider,
			modelSelectionOptions,
			overridesOfModel: state.overridesOfModel,
			chatMode: 'normal',
		};
	}

	private buildAnalysisOptions(override?: AnalysisOptions): AnalysisOptions {
		const gs = this.voidSettingsService.state.globalSettings;
		return {
			...DEFAULT_ANALYSIS_OPTIONS,
			profile: gs.functionMapAnalysisProfile,
			tokenBudget: gs.functionMapTokenBudget,
			lazyRefinement: gs.functionMapLazyRefinement,
			maxUnitNodesPerFeature: gs.functionMapMaxUnitNodesPerFeature,
			...override,
		};
	}

	async analyze(projectPath: string, options?: AnalysisOptions): Promise<void> {
		this.lastWorkspacePath = projectPath;
		this.lastAnalysisModelKey = this.modelSelectionKey();
		const jobId = generateUuid();
		this.activeJobId = jobId;
		this.setState({
			status: 'analyzing',
			progress: { jobId, stage: 'file_scan', percent: 0, message: '准备分析...' },
		});
		const llm = this.buildLlmConfig();
		const analysisOptions = this.buildAnalysisOptions(options);
		await this.channel.call('analyze', { projectPath, jobId, llm, options: analysisOptions });
	}

	scheduleReanalyze(projectPath: string): void {
		if (this._state.status === 'analyzing') {
			return;
		}
		this.lastWorkspacePath = projectPath;
		const jobId = generateUuid();
		this.reanalyzeJobId = jobId;
		this.notificationService.notify({
			severity: Severity.Info,
			message: '正在同步功能地图结构…',
		});
		const llm = this.buildLlmConfig();
		const analysisOptions = this.buildAnalysisOptions();
		void this.channel.call('scheduleReanalyze', { projectPath, jobId, llm, options: analysisOptions });
	}

	async tryLoadFromWorkspace(projectPath: string): Promise<boolean> {
		this.lastWorkspacePath = projectPath;
		this.lastAnalysisModelKey = this.modelSelectionKey();
		const graph = await this.channel.call<GraphResponse | null>('tryLoadFromWorkspace', { projectPath });
		if (graph) {
			this.setState({ status: 'ready', graph });
			return true;
		}
		return false;
	}

	async loadOrAnalyzeWorkspace(projectPath: string): Promise<void> {
		await this.tryLoadFromWorkspace(projectPath);
	}

	getDefaultAnalysisProfile(): AnalysisProfile {
		return this.voidSettingsService.state.globalSettings.functionMapAnalysisProfile;
	}

	setDefaultAnalysisProfile(profile: AnalysisProfile): void {
		this.voidSettingsService.setGlobalSetting('functionMapAnalysisProfile', profile);
	}

	hasLlmForAnalysis(): boolean {
		return !!this.buildLlmConfig();
	}

	async expandNodeAnalysis(projectId: string, nodeId: string): Promise<void> {
		const llm = this.buildLlmConfig();
		const result = await this.channel.call<{ success: boolean; graph?: GraphResponse }>(
			'expandNodeAnalysis',
			{ projectId, nodeId, llm },
		);
		if (result?.success && result.graph) {
			this.setState({ status: 'ready', graph: result.graph }, { preserveSelection: true });
		}
	}

	async refineNode(projectId: string, nodeId: string): Promise<RefineNodeResponse> {
		const llm = this.buildLlmConfig();
		return this.channel.call<RefineNodeResponse>('refineNode', { projectId, nodeId, llm });
	}

	async validateGraphEdit(projectId: string, edit: GraphEdit): Promise<ValidateEditResponse> {
		const llm = this.buildLlmConfig();
		const guardMode = this.voidSettingsService.state.globalSettings.functionMapArchitectureGuard;
		return this.channel.call<ValidateEditResponse>('validateEdit', { projectId, edit, llm, guardMode });
	}

	async applyGraphEdit(projectId: string, edit: GraphEdit, force = false): Promise<ApplyGraphEditResponse> {
		const llm = this.buildLlmConfig();
		const guardMode = this.voidSettingsService.state.globalSettings.functionMapArchitectureGuard;
		const result = await this.channel.call<ApplyGraphEditResponse>(
			'applyGraphEdit',
			{ projectId, edit, force, llm, guardMode },
		);
		if (result.success && result.graph) {
			this.setState({ status: 'ready', graph: result.graph }, { preserveSelection: true });
		}
		return result;
	}

	async getChangelog(projectId: string, nodeId?: string): Promise<GraphChangelogEntry[]> {
		return this.channel.call<GraphChangelogEntry[]>('getChangelog', { projectId, nodeId });
	}

	async exportChangelog(projectId: string): Promise<string> {
		return this.channel.call<string>('exportChangelog', { projectId });
	}

	async resolveNodeId(projectId: string, nodeIdOrAlias: string): Promise<string | null> {
		return this.channel.call<string | null>('resolveNodeId', { projectId, nodeIdOrAlias });
	}

	async getNodeDetail(projectId: string, nodeId: string): Promise<NodeDetailResponse | null> {
		return this.channel.call<NodeDetailResponse | null>('getNodeDetail', { projectId, nodeId });
	}

	async getProjectDetail(projectId: string): Promise<ProjectDetailResponse | null> {
		return this.channel.call<ProjectDetailResponse | null>('getProjectDetail', { projectId });
	}

	private async refreshChatContext(
		projectId: string,
		nodeId: string | null,
		label: string,
		level: 'project' | 'node',
		pack?: { markdown: string; primaryFilePaths: string[] } | null,
		summary?: string,
	): Promise<void> {
		let resolvedPack = pack;
		if (resolvedPack === undefined) {
			resolvedPack = await this.channel.call<{ markdown: string; primaryFilePaths: string[] } | null>(
				'buildContext',
				{ projectId, nodeId: nodeId === SYS_ROOT_ID ? null : nodeId },
			).then(p => p ? { markdown: p.markdown, primaryFilePaths: p.primaryFilePaths } : null);
		}
		if (!resolvedPack) {
			this._chatContext = null;
		} else {
			this._chatContext = {
				level,
				label,
				nodeId,
				markdown: resolvedPack.markdown,
				primaryFilePaths: resolvedPack.primaryFilePaths,
				summary,
			};
		}
		this._onDidChangeChatContext.fire(this._chatContext);
	}

	async selectNode(projectId: string, nodeId: string): Promise<void> {
		const resolved = await this.resolveNodeId(projectId, nodeId) ?? nodeId;
		let result: SelectNodeContextResponse;
		try {
			result = await this.channel.call<SelectNodeContextResponse>(
				'selectNodeContext',
				{ projectId, nodeId: resolved },
			);
		} catch {
			result = { detail: null, pack: null };
		}
		let { detail, pack } = result;
		if (!detail && this._state.status === 'ready') {
			const node = this._state.graph.nodes.find(n => n.id === resolved);
			if (node) {
				const stagePaths = node.linkedFiles
					.filter(f => f.role === 'primary' || f.role === 'core')
					.slice(0, 8)
					.map(f => f.path);
				detail = {
					id: node.id,
					name: node.name,
					nameEn: node.nameEn,
					status: node.status,
					description: node.description,
					summary: node.summary,
					files: node.linkedFiles,
					upstream: node.upstream
						.map(id => this._state.status === 'ready' ? this._state.graph.nodes.find(n => n.id === id) : null)
						.filter((n): n is NonNullable<typeof n> => !!n)
						.map(n => ({ id: n.id, name: n.name })),
					downstream: node.downstream
						.map(id => this._state.status === 'ready' ? this._state.graph.nodes.find(n => n.id === id) : null)
						.filter((n): n is NonNullable<typeof n> => !!n)
						.map(n => ({ id: n.id, name: n.name })),
					preview: node.preview,
					tags: node.tags,
					routes: [],
					apis: [],
				};
				if (!pack) {
					pack = {
						level: 'node',
						context: {
							nodeId: node.id,
							nodeName: node.name,
							description: node.description,
							summary: node.summary,
							files: node.linkedFiles,
							fileSummaries: [],
							upstream: [],
							downstream: [],
							routes: [],
							apis: [],
							recentChanges: [],
						},
						markdown: `# 功能节点: ${node.name}\n\n${node.summary}\n\n## 定义\n${node.description}`,
						primaryFilePaths: stagePaths,
					};
				}
			}
		}
		this._selection = {
			nodeId: resolved,
			level: 'node',
			detail,
			projectDetail: null,
		};
		this._onDidChangeSelection.fire(this._selection);
		if (detail && pack) {
			await this.refreshChatContext(projectId, resolved, detail.name, 'node', pack, detail.summary);
			void this.enrichChatContextAsync(projectId, resolved, detail.name, detail.summary);
		} else if (detail) {
			await this.refreshChatContext(projectId, resolved, detail.name, 'node', undefined, detail.summary);
		}
	}

	private async enrichChatContextAsync(
		projectId: string,
		nodeId: string,
		label: string,
		summary: string,
	): Promise<void> {
		const fullPack = await this.channel.call<{ markdown: string; primaryFilePaths: string[] } | null>(
			'buildContext',
			{ projectId, nodeId },
		);
		if (!fullPack || this._selection.nodeId !== nodeId) {
			return;
		}
		await this.refreshChatContext(projectId, nodeId, label, 'node', fullPack, summary);
	}

	async selectProject(projectId: string): Promise<void> {
		const result = await this.channel.call<SelectNodeContextResponse & { projectDetail?: ProjectDetailResponse | null }>(
			'selectProjectContext',
			{ projectId },
		);
		const projectDetail = result.projectDetail ?? null;
		this._selection = {
			nodeId: SYS_ROOT_ID,
			level: 'project',
			detail: null,
			projectDetail,
		};
		this._onDidChangeSelection.fire(this._selection);
		const label = projectDetail?.projectName ?? '项目';
		await this.refreshChatContext(projectId, SYS_ROOT_ID, label, 'project', result.pack ?? undefined);
	}

	async submitPrompt(nodeId: string, text: string): Promise<SubmitPromptResponse> {
		if (this._state.status !== 'ready') {
			return {
				stub: true,
				nodeId,
				accepted: false,
				message: 'Project is not ready',
			};
		}
		const ctx = this._chatContext;
		if (!ctx) {
			return {
				stub: true,
				nodeId,
				accepted: false,
				message: 'No function map context is active',
			};
		}
		const matchesNode = ctx.nodeId === nodeId;
		const matchesProject = ctx.level === 'project' && (nodeId === SYS_ROOT_ID || nodeId === null);
		if (!matchesNode && !matchesProject) {
			return {
				stub: true,
				nodeId,
				accepted: false,
				message: 'nodeId does not match the active function map context',
			};
		}
		return this.channel.call<SubmitPromptResponse>('submitPrompt', {
			projectId: this._state.graph.projectId,
			nodeId: nodeId === null ? SYS_ROOT_ID : nodeId,
			text,
		});
	}

	clearSelection(): void {
		this._selection = {
			nodeId: null,
			level: 'none',
			detail: null,
			projectDetail: null,
		};
		this._chatContext = null;
		this._onDidChangeSelection.fire(this._selection);
		this._onDidChangeChatContext.fire(null);
	}

	toggleNodeExpanded(nodeId: string): void {
		const wasExpanded = this._expandedNodeIds.has(nodeId);
		if (wasExpanded) {
			this._expandedNodeIds.delete(nodeId);
		} else {
			this._expandedNodeIds.add(nodeId);
		}
		this._onDidChangeExpandedNodes.fire(this._expandedNodeIds);

		if (!wasExpanded && this.voidSettingsService.state.globalSettings.functionMapLazyRefinement) {
			if (this._state.status === 'ready') {
				void this.expandNodeAnalysis(this._state.graph.projectId, nodeId);
			}
		}
	}

	collapseAllNodes(): void {
		this._expandedNodeIds.clear();
		this._onDidChangeExpandedNodes.fire(this._expandedNodeIds);
	}

	setFocusNode(nodeId: string | null): void {
		const next = nodeId === SYS_ROOT_ID ? null : nodeId;
		if (this._focusNodeId === next) {
			return;
		}
		this._focusNodeId = next;
		this._onDidChangeFocusNode.fire(next);
	}

	drillIntoNode(nodeId: string): void {
		if (nodeId === SYS_ROOT_ID) {
			this.setFocusNode(null);
			return;
		}
		this.setFocusNode(nodeId);
		if (!this._expandedNodeIds.has(nodeId)) {
			this._expandedNodeIds.add(nodeId);
			this._onDidChangeExpandedNodes.fire(this._expandedNodeIds);
		}
	}

	navigateFocusUp(): void {
		if (!this._focusNodeId) {
			return;
		}
		const graph = this._state.status === 'ready' ? this._state.graph : null;
		if (!graph) {
			this.setFocusNode(null);
			return;
		}
		const current = graph.nodes.find(n => n.id === this._focusNodeId);
		const parentId = current?.parentId ?? null;
		if (!parentId || parentId === SYS_ROOT_ID) {
			this.setFocusNode(null);
		} else {
			this.setFocusNode(parentId);
		}
	}

	isNodeExpanded(nodeId: string): boolean {
		return this._expandedNodeIds.has(nodeId);
	}

	private setState(state: ProjectOsAnalysisState, opts?: { preserveSelection?: boolean }): void {
		this._state = state;
		if (state.status !== 'ready' && !opts?.preserveSelection) {
			this.clearSelection();
			this.collapseAllNodes();
			this.setFocusNode(null);
		}
		this._onDidChangeState.fire(state);
	}
}

registerSingleton(IProjectOsService, ProjectOsService, InstantiationType.Delayed);
