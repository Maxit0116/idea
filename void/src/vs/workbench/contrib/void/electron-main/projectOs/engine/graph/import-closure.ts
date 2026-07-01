import type { DependencyEntry, FileRole, LinkedFile } from '../../../../common/projectOsTypes.js'

const DEFAULT_MAX_DEPTH = 3

const SKIP_PATH_PATTERNS = [
  /node_modules/i,
  /\.next\//i,
  /dist\//i,
  /build\//i,
  /\.git\//i,
]

function shouldSkipFile(filePath: string): boolean {
  return SKIP_PATH_PATTERNS.some(p => p.test(filePath))
}

function normalizePath(p: string): string {
  return p.replace(/\\/g, '/')
}

/** Build adjacency list: source -> [targets] */
function buildImportAdjacency(dependencies: DependencyEntry[]): Map<string, string[]> {
  const adj = new Map<string, string[]>()
  for (const dep of dependencies) {
    const src = normalizePath(dep.source)
    const tgt = normalizePath(dep.target)
    if (shouldSkipFile(tgt)) {
      continue
    }
    const list = adj.get(src) ?? []
    if (!list.includes(tgt)) {
      list.push(tgt)
    }
    adj.set(src, list)
  }
  return adj
}

function inferRole(filePath: string, depth: number, isAnchor: boolean): FileRole {
  if (isAnchor) {
    if (filePath.includes('/api/') || filePath.includes('route.')) {
      return 'api'
    }
    if (filePath.includes('page.') || filePath.includes('pages/')) {
      return 'primary'
    }
    return 'primary'
  }
  if (depth === 1) {
    return 'core'
  }
  if (filePath.includes('/api/') || filePath.includes('route.')) {
    return 'api'
  }
  if (filePath.includes('.test.') || filePath.includes('.spec.') || filePath.includes('__tests__')) {
    return 'test'
  }
  if (filePath.includes('config') || filePath.endsWith('.json')) {
    return 'config'
  }
  return 'supporting'
}

export interface ImportClosureResult {
  path: string
  role: FileRole
  depth: number
  reason: string
}

/**
 * Bounded BFS from anchor files along import graph.
 * Cross-directory files are included in the same feature node.
 */
export function computeImportClosure(
  anchorPaths: string[],
  dependencies: DependencyEntry[],
  maxDepth = DEFAULT_MAX_DEPTH,
): ImportClosureResult[] {
  const adj = buildImportAdjacency(dependencies)
  const visited = new Map<string, ImportClosureResult>()
  const queue: { path: string; depth: number; via: string | null }[] = []

  for (const anchor of anchorPaths) {
    const p = normalizePath(anchor)
    if (shouldSkipFile(p)) {
      continue
    }
    queue.push({ path: p, depth: 0, via: null })
  }

  while (queue.length > 0) {
    const { path, depth, via } = queue.shift()!
    if (visited.has(path)) {
      continue
    }
    if (shouldSkipFile(path)) {
      continue
    }

    const isAnchor = via === null
    const reason = isAnchor
      ? '入口锚点'
      : via
        ? `被 ${via.split('/').pop()} 引用`
        : '依赖闭包'

    visited.set(path, {
      path,
      role: inferRole(path, depth, isAnchor),
      depth,
      reason,
    })

    if (depth >= maxDepth) {
      continue
    }

    for (const target of adj.get(path) ?? []) {
      if (!visited.has(target)) {
        queue.push({ path: target, depth: depth + 1, via: path })
      }
    }
  }

  return Array.from(visited.values()).sort((a, b) => {
    const roleOrder: Record<FileRole, number> = {
      primary: 0,
      api: 1,
      core: 2,
      supporting: 3,
      config: 4,
      test: 5,
    }
    const rd = roleOrder[a.role] - roleOrder[b.role]
    if (rd !== 0) {
      return rd
    }
    return a.path.localeCompare(b.path)
  })
}

export function closureToLinkedFiles(results: ImportClosureResult[]): LinkedFile[] {
  return results.map(r => ({
    path: r.path,
    role: r.role,
    summary: r.reason,
  }))
}
