/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useCallback, useEffect, useState } from 'react';
import { URI } from '../../../../../../../base/common/uri.js';
import type { GraphResponse } from '../../../../common/projectOsTypes.js';
import { mountFnGenerator } from '../util/mountFnGenerator.js';
import ErrorBoundary from '../sidebar-tsx/ErrorBoundary.js';
import { useAccessor, useIsDark } from '../util/services.js';
import {
	NodeInspectorBody,
	ProjectInspectorBody,
	AnalysisLoadingOverlay,
	StaleGraphBanner,
} from './functionMapParts.js';
import { AnalysisProfileDialog } from './AnalysisProfileDialog.js';
import { useAnalyzeWithDialog } from './useAnalyzeWithDialog.js';

export interface FunctionMapSidebarPanelProps {
	containerWidth?: number;
	containerHeight?: number;
}

const SYS_ROOT_ID = 'sys_root';

function ProjectOverview({ graph, onAnalyze }: { graph: GraphResponse; onAnalyze: () => void }) {
	const featureNodes = graph.nodes.filter(n => n.id !== SYS_ROOT_ID);
	return (
		<div className="p-4 space-y-4">
			<div>
				<div className="text-void-fg-1 font-semibold text-sm">{graph.projectName}</div>
				<div className="text-void-fg-3 text-xs mt-1">{graph.projectType} · {featureNodes.length} 功能模块</div>
			</div>
			<div>
				<div className="text-void-fg-3 text-xs font-medium uppercase tracking-wider mb-2">模块列表</div>
				<div className="space-y-1 max-h-48 overflow-y-auto">
					{featureNodes.map(n => (
						<div key={n.id} className="text-void-fg-2 text-xs px-2 py-1.5 rounded bg-void-bg-3 truncate">
							{n.name}
							<span className="text-void-fg-3 ml-1">({n.linkedFiles.length})</span>
						</div>
					))}
				</div>
			</div>
			<p className="text-void-fg-3 text-xs leading-relaxed">
				点击中心<strong className="text-void-fg-2">项目根节点</strong>或任意功能模块，右侧 AI Chat 将自动加载对应 context。
			</p>
			<button
				onClick={onAnalyze}
				className="w-full px-3 py-2 text-xs text-void-fg-2 border border-void-border rounded-lg hover:bg-void-bg-3 transition-colors"
			>
				↺ 重新分析项目
			</button>
		</div>
	);
}

function FunctionMapSidebarPanel({ containerWidth, containerHeight }: FunctionMapSidebarPanelProps = {}) {
	const accessor = useAccessor();
	const isDark = useIsDark();
	const projectOsService = accessor.get('IProjectOsService');
	const workspaceService = accessor.get('IWorkspaceContextService');
	const commandService = accessor.get('ICommandService');

	const [analysisState, setAnalysisState] = useState(projectOsService.state);
	const [selection, setSelection] = useState(projectOsService.selection);

	useEffect(() => {
		setAnalysisState(projectOsService.state);
		setSelection(projectOsService.selection);
		const d1 = projectOsService.onDidChangeState(s => setAnalysisState(s));
		const d2 = projectOsService.onDidChangeSelection(s => setSelection(s));
		return () => { d1.dispose(); d2.dispose(); };
	}, [projectOsService]);

	const graph = analysisState.status === 'ready' ? analysisState.graph : null;
	const detail = selection.detail;
	const projectDetail = selection.projectDetail;
	const isProjectLevel = selection.level === 'project' && projectDetail;

	const {
		dialogOpen,
		hasLlm,
		defaultProfile,
		openAnalyzeDialog,
		confirmDialog,
		cancelDialog,
	} = useAnalyzeWithDialog();

	const handleAnalyze = useCallback(() => {
		const folders = workspaceService.getWorkspace().folders;
		if (folders.length === 0) {
			return;
		}
		openAnalyzeDialog(folders[0].uri.fsPath);
	}, [openAnalyzeDialog, workspaceService]);

	const handleRefine = useCallback(async () => {
		if (!graph || !detail) {
			return;
		}
		const result = await projectOsService.refineNode(graph.projectId, detail.id);
		if (result.suggestions.length > 0) {
			const first = result.suggestions[0]!;
			await projectOsService.applyGraphEdit(graph.projectId, first.patch);
			await projectOsService.selectNode(graph.projectId, detail.id);
		}
	}, [graph, detail, projectOsService]);

	const handleRename = useCallback(async (name: string) => {
		if (!graph || !detail) {
			return;
		}
		await projectOsService.applyGraphEdit(graph.projectId, { type: 'rename', nodeId: detail.id, name });
		await projectOsService.selectNode(graph.projectId, detail.id);
	}, [graph, detail, projectOsService]);

	const handleSelectNode = useCallback(async (targetNodeId: string) => {
		if (!graph) {
			return;
		}
		await projectOsService.selectNode(graph.projectId, targetNodeId);
	}, [graph, projectOsService]);

	const handleOpenFile = useCallback((filePath: string, line?: number) => {
		if (!graph) {
			return;
		}
		const absPath = graph.projectPath + '/' + filePath.replace(/^\//, '');
		const options = line ? { selection: { startLineNumber: line, startColumn: 1, endLineNumber: line, endColumn: 1 } } : undefined;
		commandService.executeCommand('vscode.open', URI.file(absPath), options);
	}, [graph, commandService]);

	const height = containerHeight && containerHeight > 0 ? containerHeight : '100%';
	const width = containerWidth && containerWidth > 0 ? containerWidth : '100%';

	const headerTitle = isProjectLevel
		? '项目'
		: detail
			? '功能节点'
			: '架构信息';

	return (
		<ErrorBoundary>
			<AnalysisProfileDialog
				open={dialogOpen}
				hasLlm={hasLlm}
				defaultProfile={defaultProfile}
				onConfirm={confirmDialog}
				onCancel={cancelDialog}
			/>
			<div
				className={`@@void-scope ${isDark ? 'dark' : ''} flex flex-col bg-void-bg-1 text-void-fg-1 overflow-hidden`}
				style={{ width, height }}
			>
				<div className="px-3 py-2 border-b border-void-border flex-shrink-0">
					<div className="text-xs font-semibold text-void-fg-2 uppercase tracking-wider">{headerTitle}</div>
					<div className="text-[10px] text-void-fg-3 mt-0.5 capitalize">{analysisState.status}</div>
				</div>
				<div className="flex-1 overflow-y-auto min-h-0">
					{analysisState.status === 'idle' && (
						<div className="p-4 text-center space-y-3">
							<p className="text-void-fg-3 text-xs">尚未分析项目。请打开主编辑区的功能地图并点击「开始分析」。</p>
							<button onClick={handleAnalyze} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg">
								开始分析
							</button>
						</div>
					)}
					{analysisState.status === 'analyzing' && (
						<AnalysisLoadingOverlay progress={analysisState.progress} fullscreen={false} />
					)}
					{analysisState.status === 'error' && (
						<div className="p-4 text-center space-y-2">
							<div className="text-red-400 text-xs">{analysisState.message}</div>
							<button onClick={handleAnalyze} className="text-xs text-void-fg-3 underline">重试</button>
						</div>
					)}
					{analysisState.status === 'ready' && graph && (
						<div className="px-3 pt-3">
							<StaleGraphBanner graph={graph} onReanalyze={handleAnalyze} />
						</div>
					)}
					{analysisState.status === 'ready' && graph && isProjectLevel && (
						<div className="flex flex-col h-full">
							<div className="flex items-start justify-between p-4 border-b border-void-border">
								<div className="min-w-0 flex-1">
									<div className="text-void-fg-1 font-semibold text-sm truncate">{projectDetail!.projectName}</div>
									<div className="text-void-fg-3 text-xs mt-0.5">项目根节点 · 全项目 context</div>
								</div>
								<button
									onClick={() => projectOsService.clearSelection()}
									className="text-void-fg-3 hover:text-void-fg-1 ml-2 flex-shrink-0 text-lg leading-none"
								>
									×
								</button>
							</div>
							<ProjectInspectorBody detail={projectDetail!} onAnalyze={handleAnalyze} />
						</div>
					)}
					{analysisState.status === 'ready' && graph && detail && !isProjectLevel && (
						<div className="flex flex-col h-full">
							<div className="flex items-start justify-between p-4 border-b border-void-border">
								<div className="min-w-0 flex-1">
									<div className="text-void-fg-1 font-semibold text-sm truncate">{detail.name}</div>
									<div className="text-void-fg-3 text-xs mt-0.5 truncate">{detail.nameEn}</div>
								</div>
								<button
									onClick={() => projectOsService.clearSelection()}
									className="text-void-fg-3 hover:text-void-fg-1 ml-2 flex-shrink-0 text-lg leading-none"
								>
									×
								</button>
							</div>
							<NodeInspectorBody
								detail={detail}
								onOpenFile={handleOpenFile}
								onSelectNode={handleSelectNode}
								projectId={graph.projectId}
								onRefine={handleRefine}
								onRename={handleRename}
							/>
						</div>
					)}
					{analysisState.status === 'ready' && graph && !detail && !isProjectLevel && (
						<ProjectOverview graph={graph} onAnalyze={handleAnalyze} />
					)}
				</div>
			</div>
		</ErrorBoundary>
	);
}

export const mountFunctionMapSidebar = mountFnGenerator(FunctionMapSidebarPanel);
