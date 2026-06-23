import type { DebugContext } from '../../../../common/projectOsTypes.js'

const ERROR_PATTERNS = [
  { source: 'compiler' as const, regex: /(?:error TS\d+|SyntaxError|Module not found)/i },
  { source: 'runtime' as const, regex: /(?:TypeError|ReferenceError|RangeError|Cannot read prop)/i },
  { source: 'terminal' as const, regex: /(?:ENOENT|EACCES|ECONNREFUSED|npm ERR)/i },
]

export function parseError(raw: string, relatedFiles: string[] = []): DebugContext {
  const lines = raw.split('\n').filter(Boolean)
  const firstLine = lines[0] ?? raw

  let source: DebugContext['source'] = 'terminal'
  for (const pattern of ERROR_PATTERNS) {
    if (pattern.regex.test(raw)) {
      source = pattern.source
      break
    }
  }

  const fileMatch = raw.match(/(?:at\s+.*?\(|in\s+|File\s+)([^\s:()]+):(\d+)/i)
  const file = fileMatch?.[1] ?? null
  const line = fileMatch?.[2] ? parseInt(fileMatch[2], 10) : null

  const stack = lines
    .filter(l => l.trim().startsWith('at '))
    .map(l => l.trim())

  const severity = /error/i.test(firstLine) ? 'error' as const : 'warning' as const

  return {
    errorId: `err_${Date.now().toString(36)}`,
    source,
    raw,
    parsed: { message: firstLine, file, line, stack },
    relatedNodeId: null,
    relatedFiles: file ? [file, ...relatedFiles] : relatedFiles,
    severity,
  }
}

export function matchErrorToNode(
  debug: DebugContext,
  nodeFileMap: Map<string, string[]>
): string | null {
  for (const filePath of debug.relatedFiles) {
    for (const [nodeId, files] of nodeFileMap) {
      if (files.some(f => filePath.endsWith(f) || f.endsWith(filePath))) {
        return nodeId
      }
    }
  }
  return null
}
