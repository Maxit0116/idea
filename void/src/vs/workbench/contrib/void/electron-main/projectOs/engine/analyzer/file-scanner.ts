import * as fs from 'fs/promises'
import * as path from 'path'
import type { FileType } from '../../../../common/projectOsTypes.js'

// ── Constants ────────────────────────────────────────────────────

const IGNORE_DIRS = new Set([
  'node_modules', '.git', '.next', 'dist', 'build', 'out',
  '.projectos', '.cache', '.turbo', 'coverage', '.vercel',
  '.build', 'remote', 'test', 'tests', '__mocks__', '.github',
  'ThirdParty', 'fixtures', '.tmp',
])

const CODE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
])

const STYLE_EXTENSIONS = new Set([
  '.css', '.scss', '.module.css',
])

const ASSET_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp',
  '.woff', '.woff2', '.ttf', '.eot', '.otf',
  '.mp4', '.webm', '.mp3', '.wav',
])

const MAX_CONTENT_SIZE = 100 * 1024 // 100KB

// ── Types ────────────────────────────────────────────────────────

export interface ScannedFile {
  absolutePath: string
  relativePath: string
  type: FileType
  size: number
  lastModified: string
  content?: string
}

// ── File Classification ──────────────────────────────────────────

function classifyFile(relPath: string, ext: string): FileType {
  const normalized = relPath.replace(/\\/g, '/')

  // Test files
  if (
    /\.(test|spec)\.[^.]+$/.test(normalized) ||
    normalized.includes('__tests__/')
  ) {
    return 'test'
  }

  // Style files
  if (STYLE_EXTENSIONS.has(ext) || ext === '.module.css') {
    return 'style'
  }

  // Asset files
  if (ASSET_EXTENSIONS.has(ext) || normalized.startsWith('public/')) {
    return 'asset'
  }

  // Config files
  if (
    /\.config\.[^.]+$/.test(normalized) ||
    normalized === 'package.json' ||
    normalized.startsWith('.env') ||
    normalized.startsWith('prisma/') ||
    normalized === 'middleware.ts' ||
    normalized === 'middleware.js'
  ) {
    return 'config'
  }

  // API routes (App Router)
  if (/^app\/api\/.*\/route\.(ts|js)$/.test(normalized) || /^app\/api\/.*route\.(ts|js)$/.test(normalized)) {
    return 'api'
  }

  // API routes (Pages Router)
  if (normalized.startsWith('pages/api/')) {
    return 'api'
  }

  // Pages (App Router)
  if (/^app\/.*\/page\.(tsx|jsx|ts|js)$/.test(normalized) || /^app\/page\.(tsx|jsx|ts|js)$/.test(normalized)) {
    return 'page'
  }

  // Pages (Pages Router)
  if (/^pages\/.*\.(tsx|jsx|ts|js)$/.test(normalized) && !normalized.startsWith('pages/api/')) {
    return 'page'
  }

  // VS Code / large IDE projects
  if (normalized.startsWith('src/vs/workbench/contrib/')) {
    return 'component'
  }
  if (normalized.startsWith('src/vs/workbench/services/')) {
    return 'lib'
  }
  if (normalized.startsWith('src/vs/platform/')) {
    return 'lib'
  }
  if (normalized.startsWith('extensions/')) {
    return 'component'
  }

  // Components
  if (normalized.startsWith('components/') || normalized.includes('/components/')) {
    return 'component'
  }
  if ((ext === '.tsx' || ext === '.jsx') && !normalized.includes('layout')) {
    return 'component'
  }

  // Lib / utils / helpers
  if (
    normalized.startsWith('lib/') || normalized.includes('/lib/') ||
    normalized.startsWith('utils/') || normalized.includes('/utils/') ||
    normalized.startsWith('helpers/') || normalized.includes('/helpers/')
  ) {
    return 'lib'
  }

  return 'other'
}

// ── Directory Walker ─────────────────────────────────────────────

async function walkDirectory(
  dir: string,
  projectRoot: string,
  results: ScannedFile[],
): Promise<void> {
  let entries: Awaited<ReturnType<typeof fs.readdir>>
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return
  }

  for (const entry of entries) {
    const name = entry.name

    // Skip hidden files/directories (starting with `.`) and ignored dirs
    if (name.startsWith('.') && entry.isDirectory() && IGNORE_DIRS.has(name)) continue
    if (name.startsWith('.') && entry.isFile()) continue
    if (entry.isDirectory() && IGNORE_DIRS.has(name)) continue

    const absolutePath = path.join(dir, name)

    if (entry.isDirectory()) {
      await walkDirectory(absolutePath, projectRoot, results)
      continue
    }

    if (!entry.isFile()) continue

    const relativePath = path.relative(projectRoot, absolutePath)
    const ext = path.extname(name).toLowerCase()

    let stat: Awaited<ReturnType<typeof fs.stat>>
    try {
      stat = await fs.stat(absolutePath)
    } catch {
      continue
    }

    const fileType = classifyFile(relativePath, ext)

    const scanned: ScannedFile = {
      absolutePath,
      relativePath,
      type: fileType,
      size: stat.size,
      lastModified: stat.mtime.toISOString(),
    }

    // Read content for code files under 100KB
    if (CODE_EXTENSIONS.has(ext) && stat.size <= MAX_CONTENT_SIZE) {
      try {
        scanned.content = await fs.readFile(absolutePath, 'utf-8')
      } catch {
        // Content unavailable — continue without it
      }
    }

    results.push(scanned)
  }
}

// ── Public API ───────────────────────────────────────────────────

export async function scanFiles(projectRoot: string): Promise<ScannedFile[]> {
  const results: ScannedFile[] = []
  await walkDirectory(projectRoot, projectRoot, results)
  return results
}

export async function readPackageJson(
  projectRoot: string,
): Promise<{
  name: string
  dependencies: Record<string, string>
  devDependencies: Record<string, string>
  workspaces?: string[] | { packages: string[] }
} | null> {
  const pkgPath = path.join(projectRoot, 'package.json')
  try {
    const raw = await fs.readFile(pkgPath, 'utf-8')
    const pkg = JSON.parse(raw)
    return {
      name: pkg.name ?? '',
      dependencies: pkg.dependencies ?? {},
      devDependencies: pkg.devDependencies ?? {},
      workspaces: pkg.workspaces,
    }
  } catch {
    return null
  }
}
