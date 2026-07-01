/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useEffect, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import type { AnalysisProgress, CodeAnchor, GraphChangelogEntry, GraphResponse, LinkedFile, NodeDetailResponse, ProjectDetailResponse } from '../../../../common/projectOsTypes.js';
import { isStaleFunctionMapGraph } from '../../../../common/projectOsTypes.js';
import { formatAnalysisErrorForUser } from '../../../../common/llmErrorFormat.js';
import { ModelDropdown } from '../void-settings-tsx/ModelDropdown.js';
import { useAccessor, useSettingsState } from '../util/services.js';
import { displayInfoOfProviderName, isFeatureNameDisabled, isProviderReadyForModelOptions } from '../../../../common/voidSettingsTypes.js';
import { VOID_OPEN_SETTINGS_ACTION_ID } from '../../../voidSettingsPane.js';

/** Banner when cached graph is directory-mirror era — prompts re-analysis with AI feature tree */
export function StaleGraphBanner({ graph, onReanalyze }: { graph: GraphResponse; onReanalyze: () => void }) {
	const isStale = isStaleFunctionMapGraph({ version: graph.version ?? '0.2.0', nodes: graph.nodes })
	const isPartialAi = graph.analysisStatus === 'partial'

	if (!isStale && !isPartialAi) {
		return null;
	}

	const message = isPartialAi
		? formatAnalysisErrorForUser(graph.analysisError)
		: '当前功能地图为旧版目录聚类结果，建议使用「标准」模式重新进行 AI 功能分析。'

	return (
		<div className="flex items-center justify-between gap-3 px-3 py-2 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs">
			<div className="text-amber-200/90 leading-relaxed">{message}</div>
			<button
				type="button"
				onClick={onReanalyze}
				className="flex-shrink-0 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium whitespace-nowrap"
			>
				重新进行功能分析
			</button>
		</div>
	);
}

export function FunctionMapModelConfig({ compact = false }: { compact?: boolean }) {
	const accessor = useAccessor();
	const voidSettingsService = accessor.get('IVoidSettingsService');
	const commandService = accessor.get('ICommandService');
	const settingsState = useSettingsState();

	const useChatModel = settingsState.globalSettings.functionMapUseChatModel;
	const chatModel = settingsState.modelSelectionOfFeature.Chat;
	const analysisModel = useChatModel ? chatModel : (settingsState.modelSelectionOfFeature.FunctionMap ?? chatModel);
	const modelReady = analysisModel && isProviderReadyForModelOptions(analysisModel.providerName, settingsState);
	const chatDisabled = isFeatureNameDisabled('Chat', settingsState);

	const activeLabel = analysisModel
		? `${analysisModel.modelName} (${displayInfoOfProviderName(analysisModel.providerName).title})`
		: '未选择模型';

	return (
		<div className={`${compact ? 'space-y-2' : 'space-y-3'} w-full max-w-md`}>
			<div className="text-void-fg-3 text-xs leading-relaxed">
				架构分析默认使用右侧 AI Chat 的模型；也可单独指定分析模型（API Key 在 Settings → Main Providers 配置）。
			</div>
			<label className="flex items-center gap-2 text-xs text-void-fg-2 cursor-pointer select-none">
				<input
					type="checkbox"
					checked={useChatModel}
					onChange={e => {
						const checked = e.target.checked;
						voidSettingsService.setGlobalSetting('functionMapUseChatModel', checked);
						if (!checked && !settingsState.modelSelectionOfFeature.FunctionMap && settingsState.modelSelectionOfFeature.Chat) {
							voidSettingsService.setModelSelectionOfFeature('FunctionMap', settingsState.modelSelectionOfFeature.Chat);
						}
					}}
					className="rounded border-void-border"
				/>
				与 AI Chat 使用相同模型
			</label>
			{!useChatModel && (
				<div className="flex flex-col gap-1">
					<span className="text-[10px] text-void-fg-3 uppercase tracking-wider">分析模型</span>
					<ModelDropdown featureName="FunctionMap" className="text-xs" />
				</div>
			)}
			<div className="text-xs text-void-fg-2">
				当前：<span className="text-void-fg-1 font-medium">{activeLabel}</span>
				{modelReady ? (
					<span className="text-emerald-400 ml-2">· AI 分析已启用</span>
				) : (
					<span className="text-amber-400 ml-2">· 仅静态分析（请配置 API Key）</span>
				)}
			</div>
			{(!modelReady || chatDisabled) && (
				<button
					type="button"
					onClick={() => commandService.executeCommand(VOID_OPEN_SETTINGS_ACTION_ID)}
					className="text-xs text-[#0e70c0] hover:underline"
				>
					打开 Settings 配置 API Key →
				</button>
			)}
		</div>
	);
}

export const TAG_COLORS: Record<string, string> = {
	page: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
	api: 'bg-purple-500/20 text-purple-400 border border-purple-500/30',
	database: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
	infrastructure: 'bg-gray-500/20 text-gray-400 border border-gray-500/30',
};

export const defaultTagColor = 'bg-gray-500/20 text-gray-400 border border-gray-500/30';

function analysisLoadingLabel(progress?: AnalysisProgress): string {
	if (!progress) {
		return 'Analyzing';
	}
	if (progress.stage === 'entry_discovery') {
		return 'Discovering';
	}
	if (progress.stage === 'ai_pass1' || progress.stage === 'ai_pass2' || progress.stage === 'llm_enrichment' || progress.stage === 'ai_function_tree') {
		return 'Thinking';
	}
	if (progress.stage === 'finalize') {
		return 'Rendering';
	}
	return 'Analyzing';
}

export function AnalysisLoadingOverlay({
	progress,
	fullscreen = true,
}: {
	progress?: AnalysisProgress;
	fullscreen?: boolean;
}) {
	const label = analysisLoadingLabel(progress);
	return (
		<div
			className={`flex flex-col items-center justify-center gap-3 px-8 py-8 ${fullscreen ? 'absolute inset-0 z-20 bg-void-bg-1' : 'h-full'}`}
		>
			<LoaderCircle className="animate-spin text-blue-400" size={28} strokeWidth={2} />
			<div className="text-void-fg-1 font-medium text-sm tracking-wide">{label}…</div>
			{progress?.message && (
				<div className="text-void-fg-3 text-xs text-center max-w-xs leading-relaxed">{progress.message}</div>
			)}
		</div>
	);
}

/** @deprecated use AnalysisLoadingOverlay */
export function ProgressView({ progress }: { progress: AnalysisProgress }) {
	return <AnalysisLoadingOverlay progress={progress} fullscreen={false} />;
}

export function FileChip({ file, onOpen }: { file: LinkedFile; onOpen: (path: string) => void }) {
	const name = file.path.split('/').pop() ?? file.path;
	const dir = file.path.split('/').slice(0, -1).join('/');

	return (
		<button
			onClick={() => onOpen(file.path)}
			className="w-full text-left px-2 py-1.5 rounded hover:bg-void-bg-3 group transition-colors"
		>
			<div className="flex items-center gap-2">
				<span className="text-[9px] uppercase tracking-wide text-void-fg-3 flex-shrink-0">{file.role}</span>
				<div className="text-void-fg-2 text-xs font-mono truncate group-hover:text-void-fg-1">{name}</div>
			</div>
			{dir && <div className="text-void-fg-3 text-[10px] font-mono truncate mt-0.5 pl-8">{dir}</div>}
			{file.summary && <div className="text-void-fg-3 text-[10px] truncate mt-0.5 pl-8">{file.summary}</div>}
		</button>
	);
}

export function AnchorChip({ anchor, onOpen }: { anchor: CodeAnchor; onOpen: (path: string, line?: number) => void }) {
	const name = anchor.symbolName ?? anchor.path.split('/').pop() ?? anchor.path;
	return (
		<button
			type="button"
			onClick={() => onOpen(anchor.path, anchor.startLine)}
			className="w-full text-left px-2 py-1.5 rounded hover:bg-void-bg-3 group transition-colors"
		>
			<div className="flex items-center gap-2">
				<span className="text-[9px] uppercase tracking-wide text-void-fg-3 flex-shrink-0">{anchor.role}</span>
				<div className="text-void-fg-2 text-xs font-mono truncate group-hover:text-void-fg-1">{name}</div>
			</div>
			<div className="text-void-fg-3 text-[10px] font-mono truncate mt-0.5 pl-8">
				{anchor.path}:{anchor.startLine}-{anchor.endLine}
			</div>
			{anchor.summary && <div className="text-void-fg-3 text-[10px] truncate mt-0.5 pl-8">{anchor.summary}</div>}
		</button>
	);
}

function CollapsibleSection({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
	const [open, setOpen] = useState(defaultOpen);
	return (
		<div>
			<button type="button" onClick={() => setOpen(v => !v)} className="text-void-fg-3 text-xs font-medium uppercase tracking-wider mb-2 flex items-center gap-1 hover:text-void-fg-2">
				<span>{open ? '▼' : '▶'}</span>
				{title}
			</button>
			{open && children}
		</div>
	);
}

export function NodeInspectorBody({
	detail,
	onOpenFile,
	onSelectNode,
	projectId,
	onRefine,
	onRename,
}: {
	detail: NodeDetailResponse;
	onOpenFile: (path: string, line?: number) => void;
	onSelectNode?: (nodeId: string) => void;
	projectId?: string;
	onRefine?: () => void;
	onRename?: (name: string) => void;
}) {
	const accessor = useAccessor();
	const projectOsService = accessor.get('IProjectOsService');
	const [changelog, setChangelog] = useState<GraphChangelogEntry[]>([]);
	const [editingName, setEditingName] = useState(false);
	const [nameDraft, setNameDraft] = useState(detail.name);

	useEffect(() => {
		if (!projectId) {
			return;
		}
		void projectOsService.getChangelog(projectId, detail.id).then(setChangelog);
	}, [projectId, detail.id, projectOsService]);

	const anchors = detail.anchors ?? [];

	return (
		<div className="flex-1 overflow-y-auto p-4 space-y-5">
			<div>
				<div className="text-void-fg-3 text-xs font-medium uppercase tracking-wider mb-2">概述</div>
				{editingName ? (
					<div className="flex gap-2">
						<input
							value={nameDraft}
							onChange={e => setNameDraft(e.target.value)}
							className="flex-1 text-xs bg-void-bg-3 border border-void-border rounded px-2 py-1"
						/>
						<button
							type="button"
							className="text-xs text-blue-400"
							onClick={() => {
								setEditingName(false);
								onRename?.(nameDraft);
							}}
						>保存</button>
					</div>
				) : (
					<div className="flex items-center justify-between gap-2">
						<div className="text-void-fg-2 text-xs leading-relaxed">{detail.summary}</div>
						{onRename && (
							<button type="button" onClick={() => setEditingName(true)} className="text-[10px] text-void-fg-3 hover:text-void-fg-1">重命名</button>
						)}
					</div>
				)}
			</div>
			{detail.granularity && (
				<div>
					<div className="text-void-fg-3 text-xs font-medium uppercase tracking-wider mb-2">粒度</div>
					<span className="text-[10px] px-1.5 py-0.5 rounded bg-void-bg-3 text-void-fg-2">{detail.granularity}</span>
				</div>
			)}
			{detail.tags.length > 0 && (
				<div>
					<div className="text-void-fg-3 text-xs font-medium uppercase tracking-wider mb-2">标签</div>
					<div className="flex flex-wrap gap-1">
						{detail.tags.map(t => (
							<span key={t} className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${TAG_COLORS[t] ?? defaultTagColor}`}>{t}</span>
						))}
					</div>
				</div>
			)}
			{detail.routes && detail.routes.length > 0 && (
				<div>
					<div className="text-void-fg-3 text-xs font-medium uppercase tracking-wider mb-2">路由</div>
					<div className="flex flex-wrap gap-1">
						{detail.routes.map(r => (
							<span key={r} className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-300 font-mono">{r}</span>
						))}
					</div>
				</div>
			)}
			{detail.apis && detail.apis.length > 0 && (
				<div>
					<div className="text-void-fg-3 text-xs font-medium uppercase tracking-wider mb-2">API</div>
					<div className="flex flex-wrap gap-1">
						{detail.apis.map(a => (
							<span key={a} className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-300 font-mono">{a}</span>
						))}
					</div>
				</div>
			)}
			{anchors.length > 0 && (
				<div>
					<div className="text-void-fg-3 text-xs font-medium uppercase tracking-wider mb-2">代码锚点 ({anchors.length})</div>
					<div className="space-y-1">
						{anchors.map((a, i) => (
							<AnchorChip key={`${a.path}:${a.startLine}:${i}`} anchor={a} onOpen={onOpenFile} />
						))}
					</div>
				</div>
			)}
			<div>
				<div className="text-void-fg-3 text-xs font-medium uppercase tracking-wider mb-2">文件 ({detail.files.length})</div>
				<div className="space-y-1">
					{detail.files.map(f => (
						<FileChip key={f.path} file={f} onOpen={onOpenFile} />
					))}
				</div>
			</div>
			{detail.upstream.length > 0 && (
				<div>
					<div className="text-void-fg-3 text-xs font-medium uppercase tracking-wider mb-2">上游</div>
					<div className="space-y-1">
						{detail.upstream.map(n => (
							<button
								key={n.id}
								type="button"
								onClick={() => onSelectNode?.(n.id)}
								className={`w-full text-left text-void-fg-2 text-xs px-2 py-1 rounded bg-void-bg-3 truncate ${onSelectNode ? 'hover:bg-void-bg-2 cursor-pointer' : ''}`}
							>
								← {n.name}
							</button>
						))}
					</div>
				</div>
			)}
			{detail.downstream.length > 0 && (
				<div>
					<div className="text-void-fg-3 text-xs font-medium uppercase tracking-wider mb-2">下游</div>
					<div className="space-y-1">
						{detail.downstream.map(n => (
							<button
								key={n.id}
								type="button"
								onClick={() => onSelectNode?.(n.id)}
								className={`w-full text-left text-void-fg-2 text-xs px-2 py-1 rounded bg-void-bg-3 truncate ${onSelectNode ? 'hover:bg-void-bg-2 cursor-pointer' : ''}`}
							>
								→ {n.name}
							</button>
						))}
					</div>
				</div>
			)}
			{onRefine && (
				<button
					type="button"
					onClick={onRefine}
					className="w-full px-3 py-2 text-xs text-void-fg-2 border border-void-border rounded-lg hover:bg-void-bg-3 transition-colors"
				>
					AI 建议修正此节点
				</button>
			)}
			<CollapsibleSection title="节点标识">
				<div className="text-[10px] text-void-fg-3 space-y-1 font-mono">
					<div>ID: {detail.id}</div>
					{detail.lineage?.slug && <div>Slug: {detail.lineage.slug}</div>}
					{detail.lineage?.aliases && detail.lineage.aliases.length > 0 && (
						<div>曾用 ID: {detail.lineage.aliases.join(', ')}</div>
					)}
				</div>
			</CollapsibleSection>
			{changelog.length > 0 && (
				<CollapsibleSection title="变更历史">
					<div className="space-y-1 max-h-32 overflow-y-auto">
						{changelog.map((e, i) => (
							<div key={i} className="text-[10px] text-void-fg-3 font-mono">
								[{e.at.slice(0, 10)}] {e.reason}: {e.fromId ?? '—'} → {e.toId}
							</div>
						))}
					</div>
				</CollapsibleSection>
			)}
		</div>
	);
}

export function ProjectInspectorBody({ detail, onAnalyze }: {
	detail: ProjectDetailResponse;
	onAnalyze: () => void;
}) {
	const profileLabel = detail.analysisMeta
		? { quick: '快速（技术模块）', standard: '标准（AI 功能树）', deep: '深度（全量 AI）' }[detail.analysisMeta.profile]
		: undefined;
	const pipelineLabel = detail.analysisMeta
		? { static: '静态聚类', entry_driven: '入口驱动', ai_pass1: 'AI Pass1', ai_pass2: 'AI Pass1+2' }[detail.analysisMeta.pipeline]
		: undefined;

	return (
		<div className="flex-1 overflow-y-auto p-4 space-y-5">
			<div>
				<div className="text-void-fg-3 text-xs font-medium uppercase tracking-wider mb-2">项目概览</div>
				<div className="text-void-fg-2 text-xs leading-relaxed">
					{detail.projectType} · {detail.moduleCount} 个功能模块
					{detail.graphVersion && <span className="text-void-fg-3"> · v{detail.graphVersion}</span>}
				</div>
				{detail.analysisStatus === 'partial' && detail.analysisError && (
					<div className="text-amber-400/90 text-[11px] mt-2 leading-relaxed">
						{formatAnalysisErrorForUser(detail.analysisError)}
					</div>
				)}
				{detail.analysisMeta && (
					<div className="text-void-fg-3 text-[11px] mt-1.5 leading-relaxed">
						分析模式：{profileLabel} · {pipelineLabel}
						{detail.analysisMeta.entryCount > 0 && ` · ${detail.analysisMeta.entryCount} 个入口`}
						{detail.analysisStatus === 'partial' && (
							<span className="text-amber-400 ml-1">（AI 未完成 — 仍为技术模块聚类）</span>
						)}
					</div>
				)}
			</div>
			<div>
				<div className="text-void-fg-3 text-xs font-medium uppercase tracking-wider mb-2">主要模块</div>
				<div className="space-y-1 max-h-56 overflow-y-auto">
					{detail.topModules.map(m => (
						<div key={m.id} className="text-void-fg-2 text-xs px-2 py-1.5 rounded bg-void-bg-3 flex justify-between gap-2">
							<span className="truncate">{m.name}</span>
							<span className="text-void-fg-3 flex-shrink-0">{m.fileCount}</span>
						</div>
					))}
				</div>
			</div>
			<div>
				<div className="text-void-fg-3 text-xs font-medium uppercase tracking-wider mb-2">说明</div>
				<p className="text-void-fg-3 text-xs leading-relaxed">
					已选中项目根节点。右侧 AI Chat 已切换为<strong className="text-void-fg-2">项目级 context</strong>，可新增宏观功能或进行跨模块编辑。
				</p>
			</div>
			<button
				onClick={onAnalyze}
				className="w-full px-3 py-2 text-xs text-void-fg-2 border border-void-border rounded-lg hover:bg-void-bg-3 transition-colors"
			>
				↺ 重新分析项目
			</button>
		</div>
	);
}

export function FunctionMapChangelogExport() {
	const accessor = useAccessor();
	const projectOsService = accessor.get('IProjectOsService');
	const state = projectOsService.state;

	const handleExport = async () => {
		if (state.status !== 'ready') {
			return;
		}
		const text = await projectOsService.exportChangelog(state.graph.projectId);
		const blob = new Blob([text], { type: 'text/plain' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'graph-changelog.txt';
		a.click();
		URL.revokeObjectURL(url);
	};

	return (
		<button
			type="button"
			disabled={state.status !== 'ready'}
			onClick={() => void handleExport()}
			className="text-xs text-void-fg-2 border border-void-border rounded px-2 py-1 hover:bg-void-bg-3 disabled:opacity-40"
		>
			导出 graph 变更记录
		</button>
	);
}

export function WelcomeView({ onAnalyze, loading }: { onAnalyze: () => void; loading: boolean }) {
	return (
		<div className="flex flex-col items-center justify-center h-full gap-5 px-6 py-8 text-center overflow-y-auto">
			<div className="w-14 h-14 text-blue-400" aria-hidden>
				<svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
					<circle cx="12" cy="12" r="2.5" fill="currentColor"/>
					<circle cx="12" cy="4.5" r="1.75" fill="currentColor" opacity="0.85"/>
					<circle cx="19" cy="8.5" r="1.75" fill="currentColor" opacity="0.85"/>
					<circle cx="19" cy="15.5" r="1.75" fill="currentColor" opacity="0.85"/>
					<circle cx="12" cy="19.5" r="1.75" fill="currentColor" opacity="0.85"/>
					<circle cx="5" cy="15.5" r="1.75" fill="currentColor" opacity="0.85"/>
					<circle cx="5" cy="8.5" r="1.75" fill="currentColor" opacity="0.85"/>
					<line x1="12" y1="9.75" x2="12" y2="6.25" stroke="currentColor" strokeWidth="1.2" opacity="0.6"/>
					<line x1="13.8" y1="10.8" x2="17.4" y2="9.2" stroke="currentColor" strokeWidth="1.2" opacity="0.6"/>
					<line x1="13.8" y1="13.2" x2="17.4" y2="14.8" stroke="currentColor" strokeWidth="1.2" opacity="0.6"/>
					<line x1="12" y1="14.25" x2="12" y2="17.75" stroke="currentColor" strokeWidth="1.2" opacity="0.6"/>
					<line x1="10.2" y1="13.2" x2="6.6" y2="14.8" stroke="currentColor" strokeWidth="1.2" opacity="0.6"/>
					<line x1="10.2" y1="10.8" x2="6.6" y2="9.2" stroke="currentColor" strokeWidth="1.2" opacity="0.6"/>
				</svg>
			</div>
			<div>
				<div className="text-void-fg-1 font-semibold text-base">功能地图</div>
				<div className="text-void-fg-3 text-sm mt-1 leading-relaxed">
					静态扫描项目结构；配置 API Key 后启用 AI 语义命名与功能关系推断
				</div>
			</div>
			<FunctionMapModelConfig compact />
			<button
				onClick={onAnalyze}
				disabled={loading}
				className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm rounded-lg font-medium transition-colors"
			>
				{loading ? '分析中...' : '开始分析'}
			</button>
		</div>
	);
}
