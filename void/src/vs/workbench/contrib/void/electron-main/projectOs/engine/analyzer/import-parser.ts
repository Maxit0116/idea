import * as fs from 'fs/promises'
import * as path from 'path'
import type { DependencyEntry } from '../../../../common/projectOsTypes.js'
import type { ScannedFile } from './file-scanner.js'

// ── Import Regex ─────────────────────────────────────────────────

const IMPORT_REGEX =
  /(?:import\s+(?:[\s\S]*?)\s+from\s+['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|require\s*\(\s*['"]([^'"]+)['"]\s*\))/g

// ── Export Regex ─────────────────────────────────────────────────

const NAMED_EXPORT_REGEX =
  /export\s+(?:const|let|var|function|class|type|interface|enum)\s+(\w+)/g

const DEFAULT_EXPORT_REGEX = /export\s+default\b/

// ── Resolution Extensions ────────────────────────────────────────

const RESOLVE_EXTENSIONS = [
  '', '.ts', '.tsx', '.js', '.jsx',
  '/index.ts', '/index.tsx', '/index.js', '/index.jsx',
]

// ── Resolve Relative Import ──────────────────────────────────────

async function resolveImport(
  specifier: string,
  sourceDir: string,
  projectRoot: string,
  knownPaths: Set<string>,
): Promise<string | null> {
  const basePath = path.resolve(sourceDir, specifier)
  const relBase = path.relative(projectRoot, basePath)

  // Check known file set first
  for (const ext of RESOLVE_EXTENSIONS) {
    const candidate = relBase + ext
    const normalized = candidate.replace(/\\/g, '/')
    if (knownPaths.has(normalized)) {
      return normalized
    }
  }

  // Fall back to filesystem check
  for (const ext of RESOLVE_EXTENSIONS) {
    const candidate = basePath + ext
    try {
      const stat = await fs.stat(candidate)
      if (stat.isFile()) {
        return path.relative(projectRoot, candidate).replace(/\\/g, '/')
      }
    } catch {
      // Not found — try next
    }
  }

  return null
}

// ── Public API ───────────────────────────────────────────────────

export async function parseImports(
  files: ScannedFile[],
  projectRoot: string,
): Promise<DependencyEntry[]> {
  const dependencies: DependencyEntry[] = []

  // Build a set of known relative paths for fast lookup
  const knownPaths = new Set<string>(
    files.map((f) => f.relativePath.replace(/\\/g, '/')),
  )

  for (const file of files) {
    if (!file.content) continue

    const sourceDir = path.dirname(file.absolutePath)
    const sourceRel = file.relativePath.replace(/\\/g, '/')

    // Reset regex state
    IMPORT_REGEX.lastIndex = 0
    let match: RegExpExecArray | null

    while ((match = IMPORT_REGEX.exec(file.content)) !== null) {
      const specifier = match[1] ?? match[2] ?? match[3]
      if (!specifier) continue

      // Only resolve relative imports
      if (!specifier.startsWith('.') && !specifier.startsWith('/')) continue

      // Determine import type
      let type: DependencyEntry['type'] = 'import'
      if (match[2] !== undefined) {
        type = 'dynamic_import'
      } else if (match[3] !== undefined) {
        type = 'require'
      }

      const resolved = await resolveImport(specifier, sourceDir, projectRoot, knownPaths)
      if (resolved) {
        dependencies.push({
          source: sourceRel,
          target: resolved,
          type,
        })
      }
    }
  }

  return dependencies
}

export function extractExports(content: string): string[] {
  const exports: string[] = []

  // Named exports
  NAMED_EXPORT_REGEX.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = NAMED_EXPORT_REGEX.exec(content)) !== null) {
    if (match[1]) {
      exports.push(match[1])
    }
  }

  // Default export
  if (DEFAULT_EXPORT_REGEX.test(content)) {
    exports.push('default')
  }

  return exports
}
