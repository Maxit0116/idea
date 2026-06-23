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
	ProgressView,
} from './functionMapParts.js';

export interface FunctionMapSidebarPanelProps {
	containerWidth?: number;
	containerHeight?: number;
}

function ProjectOverview({ graph, onAnalyze }: { graph: GraphResponse; onAnalyze: () => void }) {
	const featureNodes = graph.nodes.filter(n => n.id !== 'sys_root');
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
				点击主编辑区中的节点，此处将显示模块详情、关联文件与上下游关系。
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

	const handleAnalyze = useCallback(async () => {
		const folders = workspaceService.getWorkspace().folders;
		if (folders.length === 0) {
			return;
		}
		await projectOsService.analyze(folders[0].uri.fsPath);
	}, [projectOsService, workspaceService]);

	const handleOpenFile = useCallback((filePath: string) => {
		if (!graph) {
			return;
		}
		const absPath = graph.projectPath + '/' + filePath.replace(/^\//, '');
		commandService.executeCommand('vscode.open', URI.file(absPath));
	}, [graph, commandService]);

	const height = containerHeight && containerHeight > 0 ? containerHeight : '100%';
	const width = containerWidth && containerWidth > 0 ? containerWidth : '100%';

	return (
		<ErrorBoundary>
			<div
				className={`@@void-scope ${isDark ? 'dark' : ''} flex flex-col bg-void-bg-1 text-void-fg-1 overflow-hidden`}
				style={{ width, height }}
			>
				<div className="px-3 py-2 border-b border-void-border flex-shrink-0">
					<div className="text-xs font-semibold text-void-fg-2 uppercase tracking-wider">架构信息</div>
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
						<ProgressView progress={analysisState.progress} />
					)}
					{analysisState.status === 'error' && (
						<div className="p-4 text-center space-y-2">
							<div className="text-red-400 text-xs">{analysisState.message}</div>
							<button onClick={handleAnalyze} className="text-xs text-void-fg-3 underline">重试</button>
						</div>
					)}
					{analysisState.status === 'ready' && graph && detail && (
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
							<NodeInspectorBody detail={detail} onOpenFile={handleOpenFile} />
						</div>
					)}
					{analysisState.status === 'ready' && graph && !detail && (
						<ProjectOverview graph={graph} onAnalyze={handleAnalyze} />
					)}
				</div>
			</div>
		</ErrorBoundary>
	);
}

export const mountFunctionMapSidebar = mountFnGenerator(FunctionMapSidebarPanel);
