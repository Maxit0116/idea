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

// ── Tsconfig path aliases ────────────────────────────────────────

type PathAliases = { prefix: string; target: string }[]

async function loadTsconfigPaths(projectRoot: string): Promise<PathAliases> {
  const candidates = [
    path.join(projectRoot, 'tsconfig.json'),
    path.join(projectRoot, 'src', 'tsconfig.json'),
  ]

  for (const tsconfigPath of candidates) {
    try {
      const raw = await fs.readFile(tsconfigPath, 'utf-8')
      const json = JSON.parse(raw.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, ''))
      const paths = json?.compilerOptions?.paths as Record<string, string[]> | undefined
      const baseUrl = (json?.compilerOptions?.baseUrl as string | undefined) ?? '.'
      if (!paths) continue

      const aliases: PathAliases = []
      for (const [alias, targets] of Object.entries(paths)) {
        const prefix = alias.replace(/\*$/, '')
        const target = (targets[0] ?? '').replace(/\*$/, '')
        if (!target) continue
        aliases.push({
          prefix,
          target: path.join(baseUrl, target).replace(/\\/g, '/'),
        })
      }
      if (aliases.length > 0) {
        return aliases
      }
    } catch {
      // try next candidate
    }
  }

  return []
}

function resolveAlias(
  specifier: string,
  aliases: PathAliases,
): string | null {
  for (const { prefix, target } of aliases) {
    if (specifier.startsWith(prefix)) {
      return target + specifier.slice(prefix.length)
    }
  }
  return null
}

// ── Resolve Import ───────────────────────────────────────────────

async function resolveImport(
  specifier: string,
  sourceDir: string,
  projectRoot: string,
  knownPaths: Set<string>,
  aliases: PathAliases,
): Promise<string | null> {
  let resolvedSpecifier = specifier

  if (!specifier.startsWith('.') && !specifier.startsWith('/')) {
    const aliased = resolveAlias(specifier, aliases)
    if (!aliased) {
      return null
    }
    resolvedSpecifier = aliased
  }

  const basePath = path.isAbsolute(resolvedSpecifier)
    ? path.join(projectRoot, resolvedSpecifier.replace(/^\//, ''))
    : path.resolve(sourceDir, resolvedSpecifier)
  const relBase = path.relative(projectRoot, basePath)

  for (const ext of RESOLVE_EXTENSIONS) {
    const candidate = relBase + ext
    const normalized = candidate.replace(/\\/g, '/')
    if (knownPaths.has(normalized)) {
      return normalized
    }
  }

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
  const aliases = await loadTsconfigPaths(projectRoot)

  const knownPaths = new Set<string>(
    files.map((f) => f.relativePath.replace(/\\/g, '/')),
  )

  for (const file of files) {
    if (!file.content) continue

    const sourceDir = path.dirname(file.absolutePath)
    const sourceRel = file.relativePath.replace(/\\/g, '/')

    IMPORT_REGEX.lastIndex = 0
    let match: RegExpExecArray | null

    while ((match = IMPORT_REGEX.exec(file.content)) !== null) {
      const specifier = match[1] ?? match[2] ?? match[3]
      if (!specifier) continue

      let type: DependencyEntry['type'] = 'import'
      if (match[2] !== undefined) {
        type = 'dynamic_import'
      } else if (match[3] !== undefined) {
        type = 'require'
      }

      const resolved = await resolveImport(specifier, sourceDir, projectRoot, knownPaths, aliases)
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

  NAMED_EXPORT_REGEX.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = NAMED_EXPORT_REGEX.exec(content)) !== null) {
    if (match[1]) {
      exports.push(match[1])
    }
  }

  if (DEFAULT_EXPORT_REGEX.test(content)) {
    exports.push('default')
  }

  return exports
}
