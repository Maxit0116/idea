import type { FunctionalNode, FunctionalEdge, DependencyEntry, RouteEntry } from '../../shared/types'

export function inferEdges(
  nodes: FunctionalNode[],
  dependencies: DependencyEntry[],
  routes: RouteEntry[]
): FunctionalEdge[] {
  const edges: FunctionalEdge[] = []
  const edgeSet = new Set<string>()

  inferFromImports(nodes, dependencies, edges, edgeSet)
  inferFromRouteRedirects(nodes, edges, edgeSet)
  inferSharedData(nodes, edges, edgeSet)

  for (const node of nodes) {
    node.upstream = edges
      .filter((e) => e.target === node.id)
      .map((e) => e.source)
    node.downstream = edges
      .filter((e) => e.source === node.id)
      .map((e) => e.target)
  }

  return edges
}

function inferFromImports(
  nodes: FunctionalNode[],
  dependencies: DependencyEntry[],
  edges: FunctionalEdge[],
  edgeSet: Set<string>
): void {
  const fileToNode = new Map<string, string>()
  for (const node of nodes) {
    for (const f of node.linkedFiles) {
      fileToNode.set(f.path, node.id)
    }
  }

  const crossNodeImports = new Map<string, number>()

  for (const dep of dependencies) {
    const sourceNode = fileToNode.get(dep.source)
    const targetNode = fileToNode.get(dep.target)

    if (sourceNode && targetNode && sourceNode !== targetNode) {
      const key = `${sourceNode}:${targetNode}`
      crossNodeImports.set(key, (crossNodeImports.get(key) || 0) + 1)
    }
  }

  for (const [key, count] of crossNodeImports) {
    const [source, target] = key.split(':')
    const edgeKey = `${source}->${target}`
    if (edgeSet.has(edgeKey)) continue
    edgeSet.add(edgeKey)

    edges.push({
      id: `edge_${source}_to_${target}`,
      source,
      target,
      relation: 'depends_on',
      confidence: Math.min(0.6 + count * 0.1, 0.95),
      evidence: `${count} import(s) across node boundary`
    })
  }
}

function inferFromRouteRedirects(
  nodes: FunctionalNode[],
  edges: FunctionalEdge[],
  edgeSet: Set<string>
): void {
  for (const node of nodes) {
    for (const file of node.linkedFiles) {
      const sourceNode = nodes.find((n) => n.linkedFiles.some((f) => f.path === file.path))
      if (!sourceNode) continue

      for (const targetNode of nodes) {
        if (targetNode.id === sourceNode.id) continue
        if (!targetNode.preview?.route) continue

        const route = targetNode.preview.route
        const hasRedirect = node.linkedFiles.some((f) => {
          return f.path.endsWith('.tsx') || f.path.endsWith('.ts')
        })

        if (hasRedirect && couldRedirectTo(node, targetNode)) {
          const edgeKey = `${sourceNode.id}->${targetNode.id}`
          if (edgeSet.has(edgeKey)) continue
          edgeSet.add(edgeKey)

          edges.push({
            id: `edge_${sourceNode.id}_redirect_${targetNode.id}`,
            source: sourceNode.id,
            target: targetNode.id,
            relation: 'redirects_to',
            confidence: 0.7,
            evidence: `Potential navigation to ${route}`
          })
        }
      }
    }
  }
}

function couldRedirectTo(source: FunctionalNode, target: FunctionalNode): boolean {
  const authNodes = ['login', 'signin', 'auth', 'register', 'signup']
  const sourceIsAuth = authNodes.some((a) => source.id.includes(a))
  const targetIsDashboard = target.id.includes('dashboard') || target.id.includes('home') || target.id.includes('profile')

  if (sourceIsAuth && targetIsDashboard) return true

  const profileNodes = ['profile', 'account', 'user']
  const settingsNodes = ['settings', 'preferences']
  const sourceIsProfile = profileNodes.some((p) => source.id.includes(p))
  const targetIsSettings = settingsNodes.some((s) => target.id.includes(s))

  if (sourceIsProfile && targetIsSettings) return true

  return false
}

function inferSharedData(
  nodes: FunctionalNode[],
  edges: FunctionalEdge[],
  edgeSet: Set<string>
): void {
  const dbNode = nodes.find((n) => n.id.includes('database') || n.id.includes('db'))
  if (!dbNode) return

  for (const node of nodes) {
    if (node.id === dbNode.id) continue

    const usesDb = node.linkedFiles.some((f) =>
      f.path.includes('api/') || f.path.includes('server') || f.path.includes('action')
    )

    if (usesDb) {
      const edgeKey = `${dbNode.id}->${node.id}`
      if (edgeSet.has(edgeKey)) continue
      edgeSet.add(edgeKey)

      edges.push({
        id: `edge_${dbNode.id}_data_${node.id}`,
        source: dbNode.id,
        target: node.id,
        relation: 'data_flows_to',
        confidence: 0.7,
        evidence: `${node.name} likely reads from database`
      })
    }
  }
}
