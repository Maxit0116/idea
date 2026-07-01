import { projectOsUuid } from '../projectOsUuid.js'
import type {
  FunctionalNode,
  FunctionalEdge,
  DependencyEntry,
  RouteEntry,
} from '../../../../common/projectOsTypes.js'

// ── Helpers ─────────────────────────────────────────────────────

function buildFileToNodeMap(nodes: FunctionalNode[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const node of nodes) {
    for (const file of node.linkedFiles) {
      map.set(file.path, node.id)
    }
  }
  return map
}

function edgeKey(source: string, target: string): string {
  return `${source}->${target}`
}

// ── Strategy 1: Import-Based Edges ──────────────────────────────

function inferFromImports(
  nodes: FunctionalNode[],
  dependencies: DependencyEntry[],
  fileToNode: Map<string, string>,
  seen: Set<string>,
  edges: FunctionalEdge[],
): void {
  // Count cross-node imports between each pair of nodes
  const pairCounts = new Map<string, number>()

  for (const dep of dependencies) {
    const sourceNode = fileToNode.get(dep.source)
    const targetNode = fileToNode.get(dep.target)

    if (!sourceNode || !targetNode) continue
    if (sourceNode === targetNode) continue

    const key = edgeKey(sourceNode, targetNode)
    pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1)
  }

  for (const [key, count] of pairCounts) {
    if (seen.has(key)) continue
    seen.add(key)

    const [source, target] = key.split('->')
    const confidence = Math.min(0.95, 0.6 + 0.1 * count)

    // Technical import edges — stored for internal index, not shown on Function Map
    edges.push({
      id: `edge_${projectOsUuid().slice(0, 8)}`,
      source,
      target,
      relation: 'imports',
      confidence,
      evidence: `${count} cross-node import(s)`,
    })
  }
}

// ── Strategy 2: Route Redirect Heuristics ───────────────────────

const REDIRECT_HEURISTICS: Array<{
  sourceTag: string
  targetSegments: string[]
}> = [
  { sourceTag: 'login', targetSegments: ['dashboard', 'profile', 'home'] },
  { sourceTag: 'auth', targetSegments: ['dashboard', 'profile', 'home'] },
  { sourceTag: 'profile', targetSegments: ['settings'] },
  { sourceTag: 'cart', targetSegments: ['checkout'] },
  { sourceTag: 'checkout', targetSegments: ['dashboard', 'home'] },
]

function inferFromRouteRedirects(
  nodes: FunctionalNode[],
  seen: Set<string>,
  edges: FunctionalEdge[],
): void {
  const nodeBySegment = new Map<string, FunctionalNode>()
  for (const node of nodes) {
    // Extract segment from feat_xxx id
    const segment = node.id.replace(/^feat_/, '')
    nodeBySegment.set(segment, node)
  }

  for (const heuristic of REDIRECT_HEURISTICS) {
    const sourceNode = nodeBySegment.get(heuristic.sourceTag)
    if (!sourceNode) continue

    for (const targetSegment of heuristic.targetSegments) {
      const targetNode = nodeBySegment.get(targetSegment)
      if (!targetNode) continue

      const key = edgeKey(sourceNode.id, targetNode.id)
      if (seen.has(key)) continue
      seen.add(key)

      edges.push({
        id: `edge_${projectOsUuid().slice(0, 8)}`,
        source: sourceNode.id,
        target: targetNode.id,
        relation: 'redirects_to',
        confidence: 0.7,
        evidence: `Heuristic: ${heuristic.sourceTag} typically redirects to ${targetSegment}`,
      })
    }
  }
}

// ── Strategy 3: Shared Data (Database) ──────────────────────────

function inferSharedData(
  nodes: FunctionalNode[],
  seen: Set<string>,
  edges: FunctionalEdge[],
): void {
  const dbNode = nodes.find((n) => n.id === 'feat_database')
  if (!dbNode) return

  for (const node of nodes) {
    if (node.id === dbNode.id) continue

    // Nodes with API files likely interact with the database
    const hasApiFiles = node.linkedFiles.some(
      (f) =>
        f.path.includes('/api/') ||
        f.path.includes('route.ts') ||
        f.path.includes('route.js'),
    )

    if (!hasApiFiles) continue

    const key = edgeKey(dbNode.id, node.id)
    if (seen.has(key)) continue
    seen.add(key)

    edges.push({
      id: `edge_${projectOsUuid().slice(0, 8)}`,
      source: dbNode.id,
      target: node.id,
      relation: 'data_flows_to',
      confidence: 0.75,
      evidence: `${node.nameEn} has API routes that likely use the data layer`,
    })
  }
}

// ── Populate Node Adjacency ─────────────────────────────────────

function populateAdjacency(
  nodes: FunctionalNode[],
  edges: FunctionalEdge[],
): void {
  const nodeMap = new Map<string, FunctionalNode>()
  for (const node of nodes) {
    node.upstream = []
    node.downstream = []
    nodeMap.set(node.id, node)
  }

  for (const edge of edges) {
    const sourceNode = nodeMap.get(edge.source)
    const targetNode = nodeMap.get(edge.target)

    if (sourceNode && !sourceNode.downstream.includes(edge.target)) {
      sourceNode.downstream.push(edge.target)
    }
    if (targetNode && !targetNode.upstream.includes(edge.source)) {
      targetNode.upstream.push(edge.source)
    }
  }
}

// ── Public API ──────────────────────────────────────────────────

export function inferEdges(
  nodes: FunctionalNode[],
  dependencies: DependencyEntry[],
  routes: RouteEntry[],
): FunctionalEdge[] {
  const edges: FunctionalEdge[] = []
  const seen = new Set<string>()
  const fileToNode = buildFileToNodeMap(nodes)

  // Strategy 1: Import-based dependency edges
  inferFromImports(nodes, dependencies, fileToNode, seen, edges)

  // Strategy 2: Route redirect heuristics
  inferFromRouteRedirects(nodes, seen, edges)

  // Strategy 3: Shared data via database node
  inferSharedData(nodes, seen, edges)

  // Populate upstream/downstream from user-visible functional edges only
  const displayEdges = edges.filter(e => e.relation !== 'imports')
  populateAdjacency(nodes, displayEdges)

  return edges
}
