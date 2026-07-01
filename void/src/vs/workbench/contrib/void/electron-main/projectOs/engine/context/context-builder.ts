import type {
  ProjectGraph,
  NodeContext,
  ProjectContext,
  LinkedFile,
  CodeAnchor,
} from '../../../../common/projectOsTypes.js'

function extractRoutesAndApis(files: LinkedFile[]): { routes: string[]; apis: string[] } {
  const routes = new Set<string>()
  const apis = new Set<string>()

  for (const f of files) {
    const p = f.path.replace(/\\/g, '/')
    if (f.role === 'api' || p.includes('/api/')) {
      const match = p.match(/app\/api\/(.+?)\/route\./)
      if (match) {
        apis.add(`/api/${match[1]}`)
      } else if (p.includes('/api/')) {
        apis.add(p.replace(/^.*\/api\//, '/api/'))
      }
    }
    if (f.role === 'primary' || p.includes('/page.')) {
      const appMatch = p.match(/app\/(.+?)\/page\./)
      if (appMatch) {
        routes.add(`/${appMatch[1]}`)
      }
      const pagesMatch = p.match(/pages\/(.+?)\.(tsx|jsx|ts|js)$/)
      if (pagesMatch) {
        routes.add(`/${pagesMatch[1].replace(/\/index$/, '')}`)
      }
    }
  }

  return { routes: Array.from(routes), apis: Array.from(apis) }
}

function stageFilePaths(files: LinkedFile[], limit = 8): string[] {
  const order: Record<string, number> = {
    primary: 0,
    core: 1,
  }
  return [...files]
    .filter(f => f.role === 'primary' || f.role === 'core')
    .sort((a, b) => (order[a.role] ?? 9) - (order[b.role] ?? 9))
    .slice(0, limit)
    .map(f => f.path)
}

function primaryFilePaths(files: LinkedFile[], limit = 8): string[] {
  const order: Record<string, number> = {
    primary: 0,
    api: 1,
    core: 2,
    supporting: 3,
    config: 4,
    test: 5,
  }
  return [...files]
    .sort((a, b) => (order[a.role] ?? 9) - (order[b.role] ?? 9))
    .slice(0, limit)
    .map(f => f.path)
}

// ── Node-Level Context ──────────────────────────────────────────

export function buildNodeContext(
  graph: ProjectGraph,
  nodeId: string,
): NodeContext | null {
  const node = graph.nodes.find((n) => n.id === nodeId)
  if (!node || node.id === 'sys_root') {
    return null
  }

  const upstream = node.upstream
    .map((id) => {
      const u = graph.nodes.find((n) => n.id === id)
      return u ? { id, name: u.name, summary: u.summary } : null
    })
    .filter((u): u is NonNullable<typeof u> => u !== null)

  const downstream = node.downstream
    .map((id) => {
      const d = graph.nodes.find((n) => n.id === id)
      return d ? { id, name: d.name, summary: d.summary } : null
    })
    .filter((d): d is NonNullable<typeof d> => d !== null)

  const { routes, apis } = extractRoutesAndApis(node.linkedFiles)

  return {
    nodeId: node.id,
    nodeName: node.name,
    description: node.description,
    summary: node.summary,
    files: node.linkedFiles,
    fileSummaries: primaryFilePaths(node.linkedFiles).map(path => ({
      path,
      summary: node.linkedFiles.find(f => f.path === path)?.summary ?? '',
      exports: [],
      lineCount: 0,
    })),
    upstream,
    downstream,
    routes,
    apis,
    recentChanges: [],
  }
}

function anchorStagePaths(anchors: CodeAnchor[], limit = 8): { path: string; startLine: number; endLine: number }[] {
  const order: Record<string, number> = { primary: 0, core: 1, api: 2, supporting: 3 };
  return [...anchors]
    .sort((a, b) => (order[a.role] ?? 9) - (order[b.role] ?? 9))
    .slice(0, limit)
    .map(a => ({ path: a.path, startLine: a.startLine, endLine: a.endLine }));
}

export function getNodeAnchorSnippetTargets(graph: ProjectGraph, nodeId: string, limit = 8): { path: string; startLine: number; endLine: number; summary?: string }[] {
  const node = graph.nodes.find(n => n.id === nodeId);
  if (!node) {
    return [];
  }
  if (node.anchors && node.anchors.length > 0) {
    return anchorStagePaths(node.anchors, limit).map(a => ({
      ...a,
      summary: node.anchors!.find(x => x.path === a.path && x.startLine === a.startLine)?.summary,
    }));
  }
  return stageFilePaths(node.linkedFiles, limit).map(p => ({ path: p, startLine: 1, endLine: 1, summary: node.linkedFiles.find(f => f.path === p)?.summary }));
}
export function getNodeStageFilePaths(graph: ProjectGraph, nodeId: string, limit = 8): string[] {
  return getNodeAnchorSnippetTargets(graph, nodeId, limit).map(t => t.path);
}

export function getNodePrimaryFilePaths(graph: ProjectGraph, nodeId: string): string[] {
  const node = graph.nodes.find(n => n.id === nodeId)
  if (!node) {
    return []
  }
  return primaryFilePaths(node.linkedFiles)
}

// ── Project-Level Context ───────────────────────────────────────

export function buildProjectContext(graph: ProjectGraph): ProjectContext {
  const featureNodes = graph.nodes.filter(n => n.id !== 'sys_root')
  const topNodes = [...featureNodes]
    .sort((a, b) => b.linkedFiles.length - a.linkedFiles.length)
    .slice(0, 8)
    .map((n) => ({ id: n.id, name: n.name, summary: n.summary }))

  const topologySummary = featureNodes
    .slice(0, 12)
    .map(n => `- ${n.name}: ${n.summary}`)
    .join('\n')

  return {
    projectName: graph.projectName,
    projectType: graph.projectType,
    nodeCount: featureNodes.length,
    topNodes,
    recentActivity: [],
    topologySummary,
  }
}

export function renderNodeContextMarkdown(
  ctx: NodeContext,
  opts?: { topologyMarkdown?: string; fileSnippets?: Record<string, string> },
): string {
  const lines: string[] = [
    `# 功能节点: ${ctx.nodeName}`,
    '',
    ctx.summary,
    '',
    '## 定义',
    ctx.description,
    '',
  ]
  if (opts?.topologyMarkdown?.trim()) {
    lines.push('## 拓扑定位', opts.topologyMarkdown.trim(), '')
  }
  if (ctx.routes.length > 0) {
    lines.push('## 路由', ...ctx.routes.map(r => `- ${r}`), '')
  }
  if (ctx.apis.length > 0) {
    lines.push('## API', ...ctx.apis.map(a => `- ${a}`), '')
  }
  if (ctx.upstream.length > 0) {
    lines.push('## 上游功能', ...ctx.upstream.map(u => `- ${u.name}: ${u.summary}`), '')
  }
  if (ctx.downstream.length > 0) {
    lines.push('## 下游功能', ...ctx.downstream.map(d => `- ${d.name}: ${d.summary}`), '')
  }
  lines.push('## 关联文件（路径 + 角色，非全文）')
  for (const f of ctx.files.slice(0, 20)) {
    const snippet = opts?.fileSnippets?.[f.path]
    lines.push(`- [${f.role}] ${f.path}${f.summary ? ` — ${f.summary}` : ''}`)
    if (snippet?.trim()) {
      lines.push('  ```')
      lines.push(...snippet.trim().split('\n').map(l => `  ${l}`))
      lines.push('  ```')
    }
  }
  if (ctx.files.length > 20) {
    lines.push(`- … 另有 ${ctx.files.length - 20} 个文件`)
  }
  return lines.join('\n')
}

export function renderProjectContextMarkdown(ctx: ProjectContext): string {
  const lines: string[] = [
    `# 项目: ${ctx.projectName} (${ctx.projectType})`,
    '',
    `共 ${ctx.nodeCount} 个功能模块。`,
    '',
    '## 主要模块',
    ...ctx.topNodes.map(n => `- **${n.name}**: ${n.summary}`),
    '',
    '## 拓扑摘要',
    ctx.topologySummary,
  ]
  return lines.join('\n')
}
