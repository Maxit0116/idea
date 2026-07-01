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
	filterNodesForMapView,
	buildDisplayGraph,
	hasDisplayChildren,
	focusBreadcrumb,
	remapDepthsForFocus,
	ancestorIdsForNode,
	colorByDepth,
	getNodeVisualOpacity,
} from './topology-layout.js';
import { mountFnGenerator } from '../util/mountFnGenerator.js';
import ErrorBoundary from '../sidebar-tsx/ErrorBoundary.js';
import { WelcomeView, AnalysisLoadingOverlay, FunctionMapModelConfig, StaleGraphBanner } from './functionMapParts.js';
import { AnalysisProfileDialog } from './AnalysisProfileDialog.js';
import { useAnalyzeWithDialog } from './useAnalyzeWithDialog.js';
import '../styles.css';

import { useAccessor, useIsDark, useSettingsState } from '../util/services.js';

export interface FunctionMapEditorPanelProps {
	containerWidth?: number;
	containerHeight?: number;
}

const HEADER_HEIGHT = 72; // fallback only — actual header measured via ResizeObserver
const SYS_ROOT_ID = 'sys_root';
const OPEN_SIDEBAR_COMMAND = 'projectos.openFunctionMapSidebar';
const VOID_OPEN_SIDEBAR_ACTION_ID = 'void.openSidebar';

const STATUS_RING: Record<string, string> = {
	active: '',
	in_progress: 'ring-2 ring-amber-400/80',
	error: 'ring-2 ring-red-500/80',
	suggested: 'ring-2 ring-dashed ring-gray-500/60',
};

interface FuncNodeData {
	node: FunctionalNode;
	isSelected: boolean;
	depthColor?: string;
	isExpanded: boolean;
	hasChildren: boolean;
	childCount: number;
	isFocusRoot?: boolean;
	visualOpacity?: number;
}

const FuncNode = ({ data }: NodeProps & { data: FuncNodeData }) => {
	const { node, isSelected, depthColor, isExpanded, hasChildren, childCount, isFocusRoot, visualOpacity = 1 } = data;
	const fileCount = node.linkedFiles?.length ?? 0;
	const tags = node.tags ?? [];
	const ringColor = depthColor ?? colorByDepth(node.depth);
	const isRoot = node.id === SYS_ROOT_ID || isFocusRoot;
	const statusRing = STATUS_RING[node.status] ?? '';

	return (
		<div className={`
			relative px-4 py-3 rounded-xl border transition-all duration-150 select-none
			${isRoot ? 'min-w-[160px] max-w-[220px] rounded-full text-center' : 'min-w-[140px] max-w-[200px]'}
			${isSelected ? 'bg-blue-600/20 border-blue-500 shadow-lg shadow-blue-500/20' : 'bg-void-bg-2 border-void-border hover:border-void-border-2 hover:bg-void-bg-3'}
			${statusRing}
			${node.status === 'in_progress' ? 'animate-pulse' : ''}
		`}
		style={{ boxShadow: isSelected ? undefined : `0 0 12px ${ringColor}33`, opacity: visualOpacity }}
		>
			{!isRoot && <Handle type="target" position={Position.Left} className="!border-void-border !bg-void-bg-3 !w-2 !h-2" />}
			<div className="flex items-center gap-1.5 justify-center">
				<span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: ringColor }} />
				<div className="text-sm font-semibold text-void-fg-1 truncate">{node.name}</div>
				{hasChildren && !isRoot && (
					<span className="text-[10px] text-void-fg-3">{isExpanded ? '▼' : '▶'}{childCount > 0 ? childCount : ''}</span>
				)}
			</div>
			{!isRoot && (
				<>
					<div className="text-xs text-void-fg-3 truncate mt-0.5">{node.nameEn}</div>
					<div className="flex flex-wrap gap-1 mt-2 justify-center">
						{tags.slice(0, 2).map(tag => (
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

function FitViewController({
	layoutKey,
	nodeCount,
}: {
	layoutKey: string;
	nodeCount: number;
}) {
	const { fitView } = useReactFlow();

	useEffect(() => {
		if (nodeCount === 0) {
			return;
		}
		const timer = window.setTimeout(() => {
			try {
				void fitView({ padding: 0.25, duration: layoutKey === 'initial' ? 200 : 120 });
			} catch {
				// fitView may throw if the pane has zero size
			}
		}, layoutKey === 'initial' ? 80 : 40);
		return () => window.clearTimeout(timer);
	}, [nodeCount, layoutKey, fitView]);

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
	layoutKey,
}: {
	nodes: Node[];
	edges: Edge[];
	onNodesChange: ReturnType<typeof useNodesState>[2];
	onEdgesChange: ReturnType<typeof useEdgesState>[2];
	onNodeClick: (_: React.MouseEvent, node: Node) => void;
	isDark: boolean;
	width: number;
	height: number;
	layoutKey: string;
}) {
	if (width <= 0 || height <= 0) {
		return (
			<div className="flex items-center justify-center h-full text-void-fg-3 text-xs">
				等待面板布局…
			</div>
		);
	}

	return (
		<div style={{ width, height, position: 'relative' }}>
			<ReactFlowProvider>
				<ReactFlow
					nodes={nodes}
					edges={edges}
					onNodesChange={onNodesChange}
					onEdgesChange={onEdgesChange}
					onNodeClick={onNodeClick}
					nodeTypes={nodeTypes}
					nodesDraggable={false}
					nodesConnectable={false}
					elementsSelectable
					minZoom={0.15}
					maxZoom={2}
					fitView
					fitViewOptions={{ padding: 0.2 }}
					colorMode={isDark ? 'dark' : 'light'}
					proOptions={{ hideAttribution: true }}
					style={{ width, height }}
				>
					<FitViewController layoutKey={layoutKey} nodeCount={nodes.length} />
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
		</div>
	);
}

function TopologySearchBar({ query, onChange, nodeCount, visibleCount, onCollapseAll, breadcrumb, onBreadcrumbNavigate }: {
	query: string;
	onChange: (q: string) => void;
	nodeCount: number;
	visibleCount: number;
	onCollapseAll?: () => void;
	breadcrumb?: { projectName: string; trail: FunctionalNode[] };
	onBreadcrumbNavigate?: (nodeId: string | null) => void;
}) {
	return (
		<div className="absolute top-3 left-3 z-10 flex flex-col gap-2 max-w-[calc(100%-1.5rem)]">
			{breadcrumb && breadcrumb.trail.length > 0 && onBreadcrumbNavigate && (
				<div className="flex items-center gap-1 flex-wrap bg-void-bg-2/90 backdrop-blur border border-void-border rounded-lg px-2 py-1.5 text-[11px]">
					<button
						type="button"
						onClick={() => onBreadcrumbNavigate(null)}
						className="text-void-fg-2 hover:text-void-fg-1 truncate max-w-[120px]"
					>
						{breadcrumb.projectName}
					</button>
					{breadcrumb.trail.map(node => (
						<React.Fragment key={node.id}>
							<span className="text-void-fg-3">›</span>
							<button
								type="button"
								onClick={() => onBreadcrumbNavigate(node.id)}
								className="text-void-fg-2 hover:text-void-fg-1 truncate max-w-[140px]"
							>
								{node.name}
							</button>
						</React.Fragment>
					))}
				</div>
			)}
			<div className="flex items-center gap-2">
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
				{query ? `${visibleCount}/${nodeCount}` : `${visibleCount} 可见`}
			</span>
			{onCollapseAll && (
				<button
					type="button"
					onClick={onCollapseAll}
					className="text-[10px] text-void-fg-3 bg-void-bg-2/80 px-2 py-1 rounded border border-void-border hover:text-void-fg-1"
				>
					返回项目总览
				</button>
			)}
			</div>
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
	const settingsState = useSettingsState();
	const projectOsService = accessor.get('IProjectOsService');
	const workspaceService = accessor.get('IWorkspaceContextService');
	const commandService = accessor.get('ICommandService');
	const {
		dialogOpen,
		hasLlm,
		defaultProfile,
		openAnalyzeDialog,
		confirmDialog,
		cancelDialog,
	} = useAnalyzeWithDialog();

	const [analysisState, setAnalysisState] = useState(projectOsService.state);
	const [selectedNodeId, setSelectedNodeId] = useState(projectOsService.selection.nodeId);
	const [searchQuery, setSearchQuery] = useState('');
	const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(projectOsService.expandedNodeIds);
	const [focusNodeId, setFocusNodeId] = useState<string | null>(projectOsService.focusNodeId);
	const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
	const graphFingerprintRef = React.useRef('');
	const rootRef = React.useRef<HTMLDivElement>(null);
	const headerRef = React.useRef<HTMLDivElement>(null);
	const canvasRef = React.useRef<HTMLDivElement>(null);
	const [headerHeight, setHeaderHeight] = useState(HEADER_HEIGHT);

	const editorWidth = containerWidth && containerWidth > 0 ? containerWidth : canvasSize.width;
	const editorHeight = containerHeight && containerHeight > 0 ? containerHeight : canvasSize.height;
	const canvasWidth = editorWidth > 0 ? editorWidth : 0;
	const canvasHeight = editorHeight > 0 && headerHeight > 0
		? Math.max(0, editorHeight - headerHeight)
		: (canvasSize.height > 0 ? canvasSize.height : 0);

	const measureHeaderSize = useCallback(() => {
		const el = headerRef.current;
		if (!el) {
			return;
		}
		const h = Math.floor(el.getBoundingClientRect().height);
		if (h > 0) {
			setHeaderHeight(prev => prev === h ? prev : h);
		}
	}, []);

	const measureCanvasSize = useCallback(() => {
		measureHeaderSize();
		const root = rootRef.current;
		const header = headerRef.current;
		if (root) {
			const rootRect = root.getBoundingClientRect();
			const headerH = header ? Math.floor(header.getBoundingClientRect().height) : headerHeight;
			const w = Math.floor(rootRect.width);
			const h = Math.floor(rootRect.height - headerH);
			if (w > 0 && h > 0) {
				setCanvasSize(prev => (prev.width === w && prev.height === h) ? prev : { width: w, height: h });
				return;
			}
		}
		if (containerWidth && containerWidth > 0 && containerHeight && containerHeight > 0) {
			const headerH = headerHeight > 0 ? headerHeight : HEADER_HEIGHT;
			const h = Math.max(0, containerHeight - headerH);
			if (h > 0) {
				setCanvasSize(prev => (
					prev.width === containerWidth && prev.height === h
						? prev
						: { width: containerWidth, height: h }
				));
			}
		}
	}, [containerWidth, containerHeight, headerHeight, measureHeaderSize]);

	useEffect(() => {
		const headerEl = headerRef.current;
		const rootEl = rootRef.current;
		if (!headerEl && !rootEl) {
			return;
		}
		const schedule = () => requestAnimationFrame(() => measureCanvasSize());
		schedule();
		const ro = new ResizeObserver(schedule);
		if (headerEl) {
			ro.observe(headerEl);
		}
		if (rootEl) {
			ro.observe(rootEl);
		}
		return () => ro.disconnect();
	}, [measureCanvasSize, containerWidth, containerHeight, analysisState.status]);

	useEffect(() => {
		// Re-measure when analysis phase changes (editor may not have layout yet on first paint)
		const t = window.setTimeout(() => measureCanvasSize(), 0);
		const t2 = window.setTimeout(() => measureCanvasSize(), 120);
		return () => { window.clearTimeout(t); window.clearTimeout(t2); };
	}, [analysisState.status, analysisState.status === 'analyzing' ? analysisState.progress?.percent : undefined, analysisState.status === 'ready' ? analysisState.graph?.projectId : undefined, measureCanvasSize]);

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
		const d3 = projectOsService.onDidChangeExpandedNodes(ids => setExpandedIds(ids));
		const d4 = projectOsService.onDidChangeFocusNode(id => setFocusNodeId(id));
		return () => { d1.dispose(); d2.dispose(); d3.dispose(); d4.dispose(); };
	}, [projectOsService]);

	useEffect(() => {
		measureHeaderSize();
	}, [containerHeight, analysisState.status, measureHeaderSize]);

	// Analysis is started by ProjectOsWorkspaceContribution on workspace open.

	const graph = analysisState.status === 'ready' ? analysisState.graph : null;
	const displayNodes = React.useMemo(() => {
		if (!graph?.nodes?.length) {
			return [];
		}
		try {
			return buildDisplayGraph(graph.nodes);
		} catch {
			return graph.nodes;
		}
	}, [graph]);
	const analyzingProgress = analysisState.status === 'analyzing' ? analysisState.progress : undefined;
	const showLoadingOverlay = analysisState.status === 'analyzing';
	const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
	const [edges, setEdges, onEdgesChange] = useEdgesState([]);
	const [layoutKey, setLayoutKey] = useState('initial');

	useEffect(() => {
		if (!graph) {
			setNodes([]);
			setEdges([]);
			setLayoutKey('empty');
			return;
		}

		const fingerprint = `${graph.projectId}:${graph.nodes.length}:${graph.edges?.length ?? 0}`;
		const isFreshGraph = fingerprint !== graphFingerprintRef.current;
		if (isFreshGraph) {
			graphFingerprintRef.current = fingerprint;
		}

		let baseNodes = displayNodes;
		if (searchQuery.trim()) {
			baseNodes = filterNodesWithAncestors(displayNodes, searchQuery);
		} else {
			baseNodes = filterNodesForMapView(displayNodes, focusNodeId, expandedIds);
		}
		baseNodes = remapDepthsForFocus(baseNodes, focusNodeId);

		const childCountByParent = new Map<string, number>();
		for (const n of displayNodes) {
			if (n.parentId) {
				childCountByParent.set(n.parentId, (childCountByParent.get(n.parentId) ?? 0) + 1);
			}
		}

		const layoutNodes = computeTopologyLayout(baseNodes).map(n => {
			const fn = (n.data as FuncNodeData).node;
			const childCount = childCountByParent.get(fn.id) ?? fn.children.length;
			return {
				...n,
				data: {
					...(n.data as FuncNodeData),
					isSelected: n.id === selectedNodeId,
					isExpanded: projectOsService.isNodeExpanded(fn.id),
					hasChildren: childCount > 0,
					childCount,
					isFocusRoot: focusNodeId !== null && fn.id === focusNodeId,
					visualOpacity: getNodeVisualOpacity(fn.id, selectedNodeId, baseNodes),
				},
			};
		});
		setNodes(layoutNodes);
		setEdges(computeTopologyEdges(baseNodes, graph.edges ?? [], {
			selectedId: selectedNodeId,
			crossBranchMode: settingsState.globalSettings.functionMapShowCrossBranchEdges,
		}));

		const expandKey = [...expandedIds].sort().join(',');
		setLayoutKey(isFreshGraph
			? `initial-${Date.now()}`
			: `${baseNodes.length}:${focusNodeId ?? ''}:${selectedNodeId ?? ''}:${expandKey}:${searchQuery}`);
	}, [graph, displayNodes, focusNodeId, selectedNodeId, searchQuery, expandedIds, setNodes, setEdges, projectOsService, settingsState.globalSettings.functionMapShowCrossBranchEdges]);

	// Force fitView after graph becomes ready and dimensions settle
	useEffect(() => {
		if (analysisState.status !== 'ready' || nodes.length === 0) {
			return;
		}
		const t = window.setTimeout(() => {
			setLayoutKey(k => k.startsWith('initial') ? `ready-${Date.now()}` : k);
		}, 50);
		return () => window.clearTimeout(t);
	}, [analysisState.status, analysisState.status === 'ready' ? analysisState.graph?.projectId : undefined, nodes.length, canvasWidth, canvasHeight]);

	const handleAnalyze = useCallback(() => {
		const folders = workspaceService.getWorkspace().folders;
		if (folders.length === 0) {
			return;
		}
		openAnalyzeDialog(folders[0].uri.fsPath);
	}, [openAnalyzeDialog, workspaceService]);

	const handleNodeClick = useCallback(async (_: React.MouseEvent, node: Node) => {
		if (!graph) {
			return;
		}
		const fn = displayNodes.find(n => n.id === node.id);
		if (!fn) {
			return;
		}

		if (node.id === SYS_ROOT_ID) {
			projectOsService.setFocusNode(null);
			await projectOsService.selectProject(graph.projectId);
		} else {
			if (hasDisplayChildren(displayNodes, fn.id)) {
				projectOsService.drillIntoNode(fn.id);
			}
			await projectOsService.selectNode(graph.projectId, node.id);
		}
		void commandService.executeCommand(OPEN_SIDEBAR_COMMAND);
		void commandService.executeCommand(VOID_OPEN_SIDEBAR_ACTION_ID);
	}, [graph, displayNodes, projectOsService, commandService]);

	const handleBreadcrumbNavigate = useCallback((nodeId: string | null) => {
		projectOsService.setFocusNode(nodeId);
	}, [projectOsService]);

	const handleCollapseToProject = useCallback(() => {
		projectOsService.collapseAllNodes();
		projectOsService.setFocusNode(null);
	}, [projectOsService]);

	const handleSearchChange = useCallback((q: string) => {
		setSearchQuery(q);
		if (!graph || !q.trim()) {
			return;
		}
		const hits = filterNodesWithAncestors(displayNodes, q);
		for (const n of hits) {
			if (n.id === SYS_ROOT_ID) {
				continue;
			}
			for (const aid of ancestorIdsForNode(displayNodes, n.id)) {
				if (aid !== SYS_ROOT_ID) {
					if (!projectOsService.isNodeExpanded(aid)) {
						projectOsService.toggleNodeExpanded(aid);
					}
				}
			}
		}
	}, [graph, displayNodes, projectOsService]);

	const flowWidth = canvasWidth > 0 ? canvasWidth : canvasSize.width;
	const flowHeight = canvasHeight > 0 ? canvasHeight : canvasSize.height;

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
				ref={rootRef}
				className={`@@void-scope ${isDark ? 'dark' : ''} relative flex flex-col bg-void-bg-1 text-void-fg-1 h-full w-full overflow-hidden`}
			>
				<div ref={headerRef} className="flex flex-col gap-2 px-3 py-2 border-b border-void-border flex-shrink-0">
					<div className="flex items-center justify-between">
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
					{(analysisState.status === 'idle' || analysisState.status === 'error') && (
						<FunctionMapModelConfig compact />
					)}
					{graph && analysisState.status === 'ready' && (
						<StaleGraphBanner graph={graph} onReanalyze={handleAnalyze} />
					)}
				</div>
				<div
					ref={canvasRef}
					className="relative overflow-hidden flex-1 min-h-0"
					style={{
						width: '100%',
						...(flowHeight > 0 ? { height: flowHeight, flex: 'none' } : {}),
					}}
				>
					{analysisState.status === 'idle' && (
						<WelcomeView onAnalyze={handleAnalyze} loading={false} />
					)}
					{analysisState.status === 'error' && (
						<div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
							<div className="text-red-400 text-sm">{analysisState.message}</div>
							<button onClick={handleAnalyze} className="text-xs text-void-fg-3 hover:text-void-fg-1 underline">重试</button>
						</div>
					)}
					{graph && analysisState.status === 'ready' && (
						<>
							<TopologySearchBar
								query={searchQuery}
								onChange={handleSearchChange}
								nodeCount={displayNodes.length}
								visibleCount={filterNodesForMapView(displayNodes, focusNodeId, expandedIds).length}
								onCollapseAll={focusNodeId ? handleCollapseToProject : undefined}
								breadcrumb={{ projectName: graph.projectName, trail: focusBreadcrumb(displayNodes, focusNodeId) }}
								onBreadcrumbNavigate={handleBreadcrumbNavigate}
							/>
							<DepthLegend nodes={remapDepthsForFocus(
								filterNodesForMapView(displayNodes, focusNodeId, expandedIds),
								focusNodeId,
							)} />
							{nodes.length === 0 && (
								<div className="absolute inset-0 flex items-center justify-center text-void-fg-3 text-sm z-20">
									未找到可展示的架构节点，请尝试重新分析
								</div>
							)}
							<div className="absolute inset-0">
								<TopologyFlowCanvas
									nodes={nodes}
									edges={edges}
									onNodesChange={onNodesChange}
									onEdgesChange={onEdgesChange}
									onNodeClick={handleNodeClick}
									isDark={isDark}
									width={flowWidth}
									height={flowHeight}
									layoutKey={layoutKey}
								/>
							</div>
						</>
					)}
				</div>
				{showLoadingOverlay && (
					<div className="absolute inset-0 z-50 flex items-center justify-center bg-void-bg-1/80">
						<AnalysisLoadingOverlay progress={analyzingProgress} fullscreen={false} />
					</div>
				)}
			</div>
		</ErrorBoundary>
	);
}

export const mountFunctionMapEditor = mountFnGenerator(FunctionMapEditorPanel);
/** @deprecated use mountFunctionMapEditor */
export const mountFunctionMap = mountFunctionMapEditor;
