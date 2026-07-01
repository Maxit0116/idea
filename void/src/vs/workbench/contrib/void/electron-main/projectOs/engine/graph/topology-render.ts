import type { ProjectGraph, TopologyRenderOptions } from '../../../../common/projectOsTypes.js'

export function renderTopologyMarkdown(
  graph: ProjectGraph,
  options: TopologyRenderOptions = {}
): string {
  const { focusNodeId, maxDepth = 10, includeFiles = false } = options
  const nodeMap = new Map(graph.nodes.map(n => [n.id, n]))
  const lines: string[] = []

  lines.push(`# ${graph.projectName} (${graph.projectType})`)
  lines.push(`Nodes: ${graph.nodes.length} | Edges: ${graph.edges.length}`)
  lines.push('')

  function walk(nodeId: string, indent: string, depth: number): void {
    if (depth > maxDepth) return
    const node = nodeMap.get(nodeId)
    if (!node) return

    const status = node.status !== 'active' ? ` (${node.status})` : ''
    const here = node.id === focusNodeId ? ' ← YOU ARE HERE' : ''
    const files = includeFiles ? ` [${node.linkedFiles.length} files]` : ''
    const refs = node.refs.length > 0 ? ` → refs: ${node.refs.join(', ')}` : ''

    lines.push(`${indent}- [${node.id}] ${node.name} (${node.nameEn})${status}${files}${refs}${here}`)

    if (includeFiles && node.id === focusNodeId) {
      for (const f of node.linkedFiles) {
        lines.push(`${indent}  · ${f.path} (${f.role})`)
      }
    }

    for (const childId of node.children) {
      walk(childId, indent + '  ', depth + 1)
    }
  }

  for (const rootId of graph.topology.rootIds) {
    walk(rootId, '', 0)
  }

  const orphans = graph.nodes.filter(n => n.parentId === null && !graph.topology.rootIds.includes(n.id))
  if (orphans.length > 0) {
    lines.push('')
    lines.push('Unclustered:')
    for (const node of orphans) {
      const here = node.id === focusNodeId ? ' ← YOU ARE HERE' : ''
      lines.push(`  - [${node.id}] ${node.name}${here}`)
    }
  }

  if (graph.edges.length > 0) {
    lines.push('')
    lines.push('Edges:')
    for (const edge of graph.edges) {
      if (edge.relation === 'imports') continue
      const src = nodeMap.get(edge.source)?.name ?? edge.source
      const tgt = nodeMap.get(edge.target)?.name ?? edge.target
      lines.push(`  ${src} --${edge.relation}--> ${tgt}`)
    }
  }

  return lines.join('\n')
}
