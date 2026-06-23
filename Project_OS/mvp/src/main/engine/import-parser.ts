import { resolve, dirname, extname } from 'path'
import { existsSync } from 'fs'
import type { ScannedFile } from './file-scanner'
import type { DependencyEntry } from '../../shared/types'

const IMPORT_REGEX = /(?:import\s+(?:[\s\S]*?)\s+from\s+['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|require\s*\(\s*['"]([^'"]+)['"]\s*\))/g

export function parseImports(
  files: ScannedFile[],
  projectRoot: string
): DependencyEntry[] {
  const deps: DependencyEntry[] = []
  const filePaths = new Set(files.map((f) => f.relativePath))

  for (const file of files) {
    if (!file.content) continue

    const matches = file.content.matchAll(IMPORT_REGEX)
    for (const match of matches) {
      const importPath = match[1] || match[2] || match[3]
      if (!importPath) continue

      if (!importPath.startsWith('.') && !importPath.startsWith('/')) continue

      const resolvedTarget = resolveImportPath(
        file.relativePath,
        importPath,
        projectRoot,
        filePaths
      )

      if (resolvedTarget) {
        deps.push({
          source: file.relativePath,
          target: resolvedTarget,
          type: match[2] ? 'dynamic_import' : match[3] ? 'require' : 'import'
        })
      }
    }
  }

  return deps
}

function resolveImportPath(
  sourceFile: string,
  importPath: string,
  projectRoot: string,
  knownFiles: Set<string>
): string | null {
  const sourceDir = dirname(sourceFile)
  const basePath = resolve('/', sourceDir, importPath).slice(1)

  const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs']
  const candidates = [
    basePath,
    ...extensions.map((ext) => basePath + ext),
    ...extensions.map((ext) => basePath + '/index' + ext)
  ]

  for (const candidate of candidates) {
    if (knownFiles.has(candidate)) {
      return candidate
    }
  }

  const absBase = resolve(projectRoot, basePath)
  for (const ext of extensions) {
    if (existsSync(absBase + ext)) {
      const resolved = basePath + ext
      return resolved
    }
    if (existsSync(absBase + '/index' + ext)) {
      return basePath + '/index' + ext
    }
  }

  return null
}

export function extractExports(content: string): string[] {
  const exports: string[] = []

  const namedExportRegex = /export\s+(?:const|let|var|function|class|type|interface|enum)\s+(\w+)/g
  let match: RegExpExecArray | null
  while ((match = namedExportRegex.exec(content)) !== null) {
    exports.push(match[1])
  }

  if (/export\s+default\b/.test(content)) {
    exports.push('default')
  }

  return exports
}
