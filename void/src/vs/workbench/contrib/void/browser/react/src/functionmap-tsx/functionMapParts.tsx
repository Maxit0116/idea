/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React from 'react';
import type { AnalysisProgress, LinkedFile, NodeDetailResponse } from '../../../../common/projectOsTypes.js';

export const TAG_COLORS: Record<string, string> = {
	page: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
	api: 'bg-purple-500/20 text-purple-400 border border-purple-500/30',
	database: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
	infrastructure: 'bg-gray-500/20 text-gray-400 border border-gray-500/30',
};

export const defaultTagColor = 'bg-gray-500/20 text-gray-400 border border-gray-500/30';

export function ProgressView({ progress }: { progress: AnalysisProgress }) {
	return (
		<div className="flex flex-col items-center justify-center h-full gap-4 px-8 py-8">
			<div className="text-void-fg-1 font-medium text-sm">{progress.message}</div>
			<div className="w-full max-w-[200px] bg-void-bg-3 rounded-full h-1.5">
				<div className="bg-blue-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${progress.percent}%` }} />
			</div>
			<div className="text-void-fg-3 text-xs">{progress.percent}%</div>
		</div>
	);
}

export function FileChip({ file, onOpen }: { file: LinkedFile; onOpen: (path: string) => void }) {
	const name = file.path.split('/').pop() ?? file.path;
	const dir = file.path.split('/').slice(0, -1).join('/');

	return (
		<button
			onClick={() => onOpen(file.path)}
			className="w-full text-left px-2 py-1.5 rounded hover:bg-void-bg-3 group transition-colors"
		>
			<div className="text-void-fg-2 text-xs font-mono truncate group-hover:text-void-fg-1">{name}</div>
			{dir && <div className="text-void-fg-3 text-[10px] font-mono truncate mt-0.5">{dir}</div>}
		</button>
	);
}

export function NodeInspectorBody({ detail, onOpenFile }: {
	detail: NodeDetailResponse;
	onOpenFile: (path: string) => void;
}) {
	return (
		<div className="flex-1 overflow-y-auto p-4 space-y-5">
			<div>
				<div className="text-void-fg-3 text-xs font-medium uppercase tracking-wider mb-2">概述</div>
				<div className="text-void-fg-2 text-xs leading-relaxed">{detail.summary}</div>
			</div>
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
							<div key={n.id} className="text-void-fg-2 text-xs px-2 py-1 rounded bg-void-bg-3 truncate">← {n.name}</div>
						))}
					</div>
				</div>
			)}
			{detail.downstream.length > 0 && (
				<div>
					<div className="text-void-fg-3 text-xs font-medium uppercase tracking-wider mb-2">下游</div>
					<div className="space-y-1">
						{detail.downstream.map(n => (
							<div key={n.id} className="text-void-fg-2 text-xs px-2 py-1 rounded bg-void-bg-3 truncate">→ {n.name}</div>
						))}
					</div>
				</div>
			)}
		</div>
	);
}

export function WelcomeView({ onAnalyze, loading }: { onAnalyze: () => void; loading: boolean }) {
	return (
		<div className="flex flex-col items-center justify-center h-full gap-5 px-6 text-center">
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
					分析项目架构，以拓扑星图展示功能模块与依赖关系
				</div>
			</div>
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
