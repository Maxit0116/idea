import type {
  ProjectGraph,
  NodeContext,
  ProjectContext,
} from '../../shared/types'

// ── Node-Level Context ──────────────────────────────────────────

export function buildNodeContext(
  graph: ProjectGraph,
  nodeId: string,
): NodeContext | null {
  const node = graph.nodes.find((n) => n.id === nodeId)
  if (!node) return null

  // Resolve upstream node references to name+summary
  const upstream = node.upstream
    .map((id) => {
      const upstream = graph.nodes.find((n) => n.id === id)
      return upstream
        ? { id, name: upstream.name, summary: upstream.summary }
        : null
    })
    .filter((u): u is NonNullable<typeof u> => u !== null)

  // Resolve downstream node references to name+summary
  const downstream = node.downstream
    .map((id) => {
      const downstream = graph.nodes.find((n) => n.id === id)
      return downstream
        ? { id, name: downstream.name, summary: downstream.summary }
        : null
    })
    .filter((d): d is NonNullable<typeof d> => d !== null)

  return {
    nodeId: node.id,
    nodeName: node.name,
    description: node.description,
    summary: node.summary,
    files: node.linkedFiles,
    fileSummaries: [], // M1 will populate with actual file analysis
    upstream,
    downstream,
    recentChanges: [], // M1 will add git integration
  }
}

// ── Project-Level Context ───────────────────────────────────────

export function buildProjectContext(graph: ProjectGraph): ProjectContext {
  // Pick top 5 nodes by file count (most significant)
  const topNodes = [...graph.nodes]
    .sort((a, b) => b.linkedFiles.length - a.linkedFiles.length)
    .slice(0, 5)
    .map((n) => ({ id: n.id, name: n.name }))

  return {
    projectName: graph.projectName,
    projectType: graph.projectType,
    nodeCount: graph.nodes.length,
    topNodes,
    recentActivity: [], // M1 will add git integration
  }
}
