import type { DebugContext, BugFixJob, ProjectGraph } from '../../shared/types'
import { parseError, matchErrorToNode } from './error-parser'

export function buildDebugContext(
  raw: string,
  graph: ProjectGraph | null
): DebugContext {
  const debug = parseError(raw)

  if (graph) {
    const nodeFileMap = new Map<string, string[]>()
    for (const node of graph.nodes) {
      nodeFileMap.set(node.id, node.linkedFiles.map(f => f.path))
    }
    debug.relatedNodeId = matchErrorToNode(debug, nodeFileMap)
  }

  return debug
}

export function createBugFixJob(debug: DebugContext): BugFixJob {
  return {
    jobId: `bugfix_${Date.now().toString(36)}`,
    errorId: debug.errorId,
    debugContext: debug,
    status: 'diagnosing',
    rootCause: null,
    fixSummary: null,
    filesChanged: [],
  }
}

// M3 stub: will integrate LLM for root cause analysis
export async function diagnoseBug(_job: BugFixJob): Promise<BugFixJob> {
  return {
    ..._job,
    status: 'error',
    rootCause: 'LLM integration required (M3)',
  }
}
