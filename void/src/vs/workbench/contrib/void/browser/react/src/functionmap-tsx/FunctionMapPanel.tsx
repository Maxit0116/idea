/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useCallback, useEffect, useState } from 'react';
import {
	ReactFlow,
	ReactFlowProvider,
	useReactFlow,
	Background,
	Controls,
	MiniMap,
	Handle,
	Position,
	useNodesState,
	useEdgesState,
	type Node,
	type NodeProps,
	type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type {
	FunctionalNode,
	GraphResponse,
} from '../../../../common/projectOsTypes.js';
import {
	computeTopologyLayout,
	computeTopologyEdges,
	filterNodesWithAncestors,
	colorByDepth,
} from './topology-layout.js';
import { mountFnGenerator } from '../util/mountFnGenerator.js';
import ErrorBoundary from '../sidebar-tsx/ErrorBoundary.js';
import { WelcomeView, ProgressView } from './functionMapParts.js';

import { useAccessor, useIsDark } from '../util/services.js';

export interface FunctionMapEditorPanelProps {
	containerWidth?: number;
	containerHeight?: number;
}

const HEADER_HEIGHT = 40;
const OPEN_SIDEBAR_COMMAND = 'projectos.openFunctionMapSidebar';

interface FuncNodeData {
	node: FunctionalNode;
	isSelected: boolean;
	depthColor?: string;
}

const FuncNode = ({ data }: NodeProps & { data: FuncNodeData }) => {
	const { node, isSelected, depthColor } = data;
	const fileCount = node.linkedFiles.length;
	const ringColor = depthColor ?? colorByDepth(node.depth);
	const isRoot = node.depth === 0;

	return (
		<div className={`
			relative px-4 py-3 rounded-xl border transition-all duration-150 select-none
			${isRoot ? 'min-w-[160px] max-w-[200px] rounded-full text-center' : 'min-w-[140px] max-w-[200px]'}
			${isSelected ? 'bg-blue-600/20 border-blue-500 shadow-lg shadow-blue-500/20' : 'bg-void-bg-2 border-void-border hover:border-void-border-2 hover:bg-void-bg-3'}
		`}
		style={{ boxShadow: isSelected ? undefined : `0 0 12px ${ringColor}33` }}
		>
			{!isRoot && <Handle type="target" position={Position.Left} className="!border-void-border !bg-void-bg-3 !w-2 !h-2" />}
			<div className="flex items-center gap-1.5 justify-center">
				<span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: ringColor }} />
				<div className="text-sm font-semibold text-void-fg-1 truncate">{node.name}</div>
			</div>
			{!isRoot && (
				<>
					<div className="text-xs text-void-fg-3 truncate mt-0.5">{node.nameEn}</div>
					<div className="flex flex-wrap gap-1 mt-2 justify-center">
						{node.tags.slice(0, 2).map(tag => (
							<span key={tag} className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-gray-500/20 text-gray-400 border border-gray-500/30`}>
								{tag}
							</span>
						))}
					</div>
					<div className="mt-2 text-[11px] text-void-fg-3">{fileCount} 文件 · L{node.depth}</div>
				</>
			)}
			{isRoot && <div className="text-[11px] text-void-fg-3 mt-1">{node.summary}</div>}
			<Handle
				type="source"
				position={isRoot ? Position.Bottom : Position.Right}
				className="!border-void-border !bg-void-bg-3 !w-2 !h-2"
			/>
		</div>
	);
};

const nodeTypes = { funcNode: FuncNode };

function FitViewOnResize({ width, height }: { width: number; height: number }) {
	const { fitView } = useReactFlow();
	useEffect(() => {
		if (width > 0 && height > 0) {
			requestAnimationFrame(() => fitView({ padding: 0.25 }));
		}
	}, [width, height, fitView]);
	return null;
}

function TopologyFlowCanvas({
	nodes,
	edges,
	onNodesChange,
	onEdgesChange,
	onNodeClick,
	isDark,
	width,
	height,
}: {
	nodes: Node[];
	edges: Edge[];
	onNodesChange: ReturnType<typeof useNodesState>[2];
	onEdgesChange: ReturnType<typeof useEdgesState>[2];
	onNodeClick: (_: React.MouseEvent, node: Node) => void;
	isDark: boolean;
	width: number;
	height: number;
}) {
	if (width <= 0 || height <= 0) {
		return (
			<div className="flex items-center justify-center h-full text-void-fg-3 text-xs">
				等待面板布局…
			</div>
		);
	}

	return (
		<ReactFlowProvider>
			<ReactFlow
				nodes={nodes}
				edges={edges}
				onNodesChange={onNodesChange}
				onEdgesChange={onEdgesChange}
				onNodeClick={onNodeClick}
				nodeTypes={nodeTypes}
				fitView
				fitViewOptions={{ padding: 0.25 }}
				colorMode={isDark ? 'dark' : 'light'}
				proOptions={{ hideAttribution: true }}
				style={{ width, height }}
			>
				<FitViewOnResize width={width} height={height} />
				<Background gap={20} size={1} color={isDark ? '#333' : '#ddd'} />
				<Controls position="bottom-right" />
				<MiniMap
					nodeColor={() => isDark ? '#374151' : '#e5e7eb'}
					maskColor={isDark ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.6)'}
					position="bottom-left"
					style={{ background: isDark ? '#1f2937' : '#f9fafb' }}
				/>
			</ReactFlow>
		</ReactFlowProvider>
	);
}

function TopologySearchBar({ query, onChange, nodeCount, visibleCount }: {
	query: string;
	onChange: (q: string) => void;
	nodeCount: number;
	visibleCount: number;
}) {
	return (
		<div className="absolute top-3 left-3 z-10 flex items-center gap-2">
			<div className="flex items-center gap-2 bg-void-bg-2/90 backdrop-blur border border-void-border rounded-lg px-3 py-1.5">
				<span className="text-void-fg-3 text-xs">🔍</span>
				<input
					value={query}
					onChange={e => onChange(e.target.value)}
					placeholder="搜索模块、路由、标签..."
					className="bg-transparent text-xs text-void-fg-1 outline-none w-44 placeholder:text-void-fg-3"
				/>
				{query && (
					<button onClick={() => onChange('')} className="text-void-fg-3 hover:text-void-fg-1 text-xs">×</button>
				)}
			</div>
			<span className="text-[10px] text-void-fg-3 bg-void-bg-2/80 px-2 py-1 rounded border border-void-border">
				{query ? `${visibleCount}/${nodeCount}` : `${nodeCount} 节点`}
			</span>
		</div>
	);
}

function DepthLegend({ nodes }: { nodes: FunctionalNode[] }) {
	const depthCounts = new Map<number, number>();
	for (const n of nodes) {
		depthCounts.set(n.depth, (depthCounts.get(n.depth) ?? 0) + 1);
	}
	const depths = Array.from(depthCounts.entries()).sort((a, b) => a[0] - b[0]);
	if (depths.length <= 1) return null;

	return (
		<div className="absolute bottom-3 left-3 z-10 bg-void-bg-2/90 backdrop-blur border border-void-border rounded-lg px-3 py-2">
			<div className="text-[10px] text-void-fg-3 uppercase tracking-wider mb-1.5">深度层级</div>
			<div className="flex flex-wrap gap-2">
				{depths.map(([depth, count]) => (
					<div key={depth} className="flex items-center gap-1 text-[10px] text-void-fg-2">
						<span className="w-2 h-2 rounded-full" style={{ background: colorByDepth(depth) }} />
						L{depth} ({count})
					</div>
				))}
			</div>
		</div>
	);
}

function FunctionMapEditorPanel({ containerWidth, containerHeight }: FunctionMapEditorPanelProps = {}) {
	const accessor = useAccessor();
	const isDark = useIsDark();
	const projectOsService = accessor.get('IProjectOsService');
	const workspaceService = accessor.get('IWorkspaceContextService');
	const commandService = accessor.get('ICommandService');

	const [analysisState, setAnalysisState] = useState(projectOsService.state);
	const [selectedNodeId, setSelectedNodeId] = useState(projectOsService.selection.nodeId);
	const [searchQuery, setSearchQuery] = useState('');
	const [observedSize, setObservedSize] = useState({ width: 0, height: 0 });
	const rootRef = React.useRef<HTMLDivElement>(null);

	const panelWidth = containerWidth && containerWidth > 0 ? containerWidth : observedSize.width;
	const panelHeight = containerHeight && containerHeight > 0 ? containerHeight : observedSize.height;
	const canvasHeight = Math.max(0, panelHeight - HEADER_HEIGHT);

	useEffect(() => {
		const el = rootRef.current;
		if (!el || (containerWidth && containerHeight)) {
			return;
		}
		const update = () => {
			const rect = el.getBoundingClientRect();
			const w = Math.floor(rect.width);
			const h = Math.floor(rect.height);
			if (w > 0 && h > 0) {
				setObservedSize({ width: w, height: h });
			}
		};
		update();
		const ro = new ResizeObserver(update);
		ro.observe(el);
		return () => ro.disconnect();
	}, [containerWidth, containerHeight]);

	useEffect(() => {
		setAnalysisState(projectOsService.state);
		setSelectedNodeId(projectOsService.selection.nodeId);
		const d1 = projectOsService.onDidChangeState(s => {
			setAnalysisState(s);
			if (s.status !== 'ready') {
				setSelectedNodeId(null);
			}
		});
		const d2 = projectOsService.onDidChangeSelection(s => setSelectedNodeId(s.nodeId));
		return () => { d1.dispose(); d2.dispose(); };
	}, [projectOsService]);

	useEffect(() => {
		if (projectOsService.state.status !== 'idle') {
			return;
		}
		const folders = workspaceService.getWorkspace().folders;
		if (folders.length === 0) {
			return;
		}
		void projectOsService.tryLoadFromWorkspace(folders[0].uri.fsPath);
	}, [projectOsService, workspaceService]);

	const graph = analysisState.status === 'ready' ? analysisState.graph : null;
	const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
	const [edges, setEdges, onEdgesChange] = useEdgesState([]);

	useEffect(() => {
		if (!graph) {
			setNodes([]);
			setEdges([]);
			return;
		}
		const visible = filterNodesWithAncestors(graph.nodes, searchQuery);
		const layoutNodes = computeTopologyLayout(visible).map(n => ({
			...n,
			data: {
				...(n.data as FuncNodeData),
				isSelected: n.id === selectedNodeId,
			},
		}));
		setNodes(layoutNodes);
		setEdges(computeTopologyEdges(visible, graph.edges, { selectedId: selectedNodeId }));
	}, [graph, selectedNodeId, searchQuery, setNodes, setEdges]);

	const handleAnalyze = useCallback(async () => {
		const folders = workspaceService.getWorkspace().folders;
		if (folders.length === 0) {
			return;
		}
		await projectOsService.analyze(folders[0].uri.fsPath);
	}, [projectOsService, workspaceService]);

	const handleNodeClick = useCallback(async (_: React.MouseEvent, node: Node) => {
		if (!graph || node.id === 'sys_root') {
			return;
		}
		await projectOsService.selectNode(graph.projectId, node.id);
		void commandService.executeCommand(OPEN_SIDEBAR_COMMAND);
	}, [graph, projectOsService, commandService]);

	return (
		<ErrorBoundary>
			<div
				ref={rootRef}
				className={`@@void-scope ${isDark ? 'dark' : ''} flex flex-col bg-void-bg-1 text-void-fg-1`}
				style={{
					width: panelWidth > 0 ? panelWidth : '100%',
					height: panelHeight > 0 ? panelHeight : '100%',
					overflow: 'hidden',
				}}
			>
				<div className="flex items-center justify-between px-3 py-2 border-b border-void-border flex-shrink-0" style={{ height: HEADER_HEIGHT }}>
					<span className="text-xs font-semibold text-void-fg-2 uppercase tracking-wider">功能地图</span>
					<div className="flex items-center gap-2">
						<span className="text-[10px] text-void-fg-3 capitalize">{analysisState.status}</span>
						{graph && (
							<>
								<span className="text-[10px] text-void-fg-3">{graph.projectName} · {graph.nodes.length} 模块</span>
								<button onClick={handleAnalyze} className="text-[11px] text-void-fg-3 hover:text-void-fg-1 px-2 py-0.5 rounded hover:bg-void-bg-3 transition-colors">
									↺ 重新分析
								</button>
							</>
						)}
					</div>
				</div>
				<div className="relative overflow-hidden" style={{ height: canvasHeight > 0 ? canvasHeight : '100%', flex: canvasHeight > 0 ? undefined : 1 }}>
					{analysisState.status === 'idle' && (
						<WelcomeView onAnalyze={handleAnalyze} loading={false} />
					)}
					{analysisState.status === 'analyzing' && (
						<ProgressView progress={analysisState.progress} />
					)}
					{analysisState.status === 'error' && (
						<div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
							<div className="text-red-400 text-sm">{analysisState.message}</div>
							<button onClick={handleAnalyze} className="text-xs text-void-fg-3 hover:text-void-fg-1 underline">重试</button>
						</div>
					)}
					{analysisState.status === 'ready' && graph && (
						<>
							<TopologySearchBar
								query={searchQuery}
								onChange={setSearchQuery}
								nodeCount={graph.nodes.length}
								visibleCount={filterNodesWithAncestors(graph.nodes, searchQuery).length}
							/>
							<DepthLegend nodes={graph.nodes} />
							<TopologyFlowCanvas
								nodes={nodes}
								edges={edges}
								onNodesChange={onNodesChange}
								onEdgesChange={onEdgesChange}
								onNodeClick={handleNodeClick}
								isDark={isDark}
								width={panelWidth}
								height={canvasHeight}
							/>
						</>
					)}
				</div>
			</div>
		</ErrorBoundary>
	);
}

export const mountFunctionMapEditor = mountFnGenerator(FunctionMapEditorPanel);
/** @deprecated use mountFunctionMapEditor */
export const mountFunctionMap = mountFunctionMapEditor;
