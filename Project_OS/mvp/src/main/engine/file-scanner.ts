import { readdir, stat, readFile } from 'fs/promises'
import { join, relative, extname } from 'path'
import type { FileEntry, FileType } from '../../shared/types'

const IGNORE_DIRS = new Set([
  'node_modules', '.git', '.next', 'dist', 'build', 'out',
  '.projectos', '.cache', '.turbo', 'coverage', '.vercel'
])

const CODE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'
])

const STYLE_EXTENSIONS = new Set(['.css', '.scss', '.sass', '.less', '.module.css'])

const ASSET_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp',
  '.woff', '.woff2', '.ttf', '.eot', '.mp4', '.webm'
])

export interface ScannedFile {
  absolutePath: string
  relativePath: string
  type: FileType
  size: number
  lastModified: string
  content?: string
}

export async function scanFiles(projectRoot: string): Promise<ScannedFile[]> {
  const files: ScannedFile[] = []
  await walkDir(projectRoot, projectRoot, files)
  return files
}

async function walkDir(dir: string, root: string, results: ScannedFile[]): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true })

  for (const entry of entries) {
    if (IGNORE_DIRS.has(entry.name)) continue
    if (entry.name.startsWith('.') && entry.name !== '.env.example') continue

    const fullPath = join(dir, entry.name)

    if (entry.isDirectory()) {
      await walkDir(fullPath, root, results)
    } else if (entry.isFile()) {
      const relPath = relative(root, fullPath)
      const ext = extname(entry.name)
      const fileType = classifyFile(relPath, ext)

      const stats = await stat(fullPath)
      const isCode = CODE_EXTENSIONS.has(ext)

      let content: string | undefined
      if (isCode && stats.size < 100_000) {
        try {
          content = await readFile(fullPath, 'utf-8')
        } catch {
          // skip unreadable files
        }
      }

      results.push({
        absolutePath: fullPath,
        relativePath: relPath,
        type: fileType,
        size: stats.size,
        lastModified: stats.mtime.toISOString(),
        content
      })
    }
  }
}

function classifyFile(relPath: string, ext: string): FileType {
  const normalized = relPath.replace(/\\/g, '/')

  if (normalized.match(/^(app|src\/app)\/.*\/page\.(tsx?|jsx?)$/)) return 'page'
  if (normalized.match(/^pages\/(?!api\/).*\.(tsx?|jsx?)$/)) return 'page'
  if (normalized.match(/^pages\/_.*\.(tsx?|jsx?)$/)) return 'page'

  if (normalized.match(/^(app|src\/app)\/api\/.*\/route\.(tsx?|jsx?)$/)) return 'api'
  if (normalized.match(/^pages\/api\/.*\.(tsx?|jsx?)$/)) return 'api'

  if (normalized.match(/\.(test|spec)\.(tsx?|jsx?)$/)) return 'test'
  if (normalized.match(/^__tests__\//)) return 'test'

  if (normalized.match(/\.(config)\.(ts|js|mjs|cjs)$/)) return 'config'
  if (normalized.match(/^(next|tailwind|postcss|jest|vite|tsconfig)/)) return 'config'
  if (normalized === 'package.json') return 'config'
  if (normalized.match(/^\.env/)) return 'config'
  if (normalized.match(/^prisma\//)) return 'config'
  if (normalized === 'middleware.ts' || normalized === 'middleware.js') return 'config'

  if (STYLE_EXTENSIONS.has(ext)) return 'style'

  if (ASSET_EXTENSIONS.has(ext)) return 'asset'
  if (normalized.startsWith('public/')) return 'asset'

  if (normalized.match(/^(components|src\/components)\//)) return 'component'
  if (ext === '.tsx' || ext === '.jsx') {
    if (!normalized.includes('page.') && !normalized.includes('layout.')) {
      return 'component'
    }
  }

  if (normalized.match(/^(lib|utils|helpers|services|hooks|src\/(lib|utils|helpers|services|hooks))\//)) {
    return 'lib'
  }

  if (CODE_EXTENSIONS.has(ext)) return 'lib'

  return 'other'
}

export async function readPackageJson(projectRoot: string): Promise<{
  name: string
  dependencies: Record<string, string>
  devDependencies: Record<string, string>
} | null> {
  try {
    const raw = await readFile(join(projectRoot, 'package.json'), 'utf-8')
    const pkg = JSON.parse(raw)
    return {
      name: pkg.name || 'unknown',
      dependencies: pkg.dependencies || {},
      devDependencies: pkg.devDependencies || {}
    }
  } catch {
    return null
  }
}
