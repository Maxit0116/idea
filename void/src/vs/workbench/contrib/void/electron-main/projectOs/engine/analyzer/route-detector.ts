import type { RouteEntry } from '../../../../common/projectOsTypes.js'
import type { ScannedFile } from './file-scanner.js'

// ── App Router Detection ─────────────────────────────────────────

function detectAppRouterRoutes(files: ScannedFile[]): RouteEntry[] {
  const routes: RouteEntry[] = []

  for (const file of files) {
    const rel = file.relativePath.replace(/\\/g, '/')

    // Must be inside `app/` directory
    if (!rel.startsWith('app/')) continue

    const fileName = rel.split('/').pop() ?? ''
    const nameWithoutExt = fileName.replace(/\.(tsx?|jsx?)$/, '')

    let type: RouteEntry['type'] | null = null

    switch (nameWithoutExt) {
      case 'page':
        type = 'page'
        break
      case 'route':
        type = 'api'
        break
      case 'layout':
        type = 'layout'
        break
      case 'loading':
        type = 'loading'
        break
      case 'error':
        type = 'error'
        break
      case 'middleware':
        type = 'middleware'
        break
      default:
        continue
    }

    // Build URL path from directory structure
    // e.g. app/dashboard/settings/page.tsx -> /dashboard/settings
    const dirParts = rel.split('/')
    // Remove "app" prefix and filename
    const pathSegments = dirParts.slice(1, -1)

    // Filter out route group segments like (marketing)
    const urlSegments = pathSegments.filter((seg) => !seg.startsWith('('))

    const urlPath = '/' + urlSegments.join('/')

    // Detect dynamic segments
    const params: string[] = []
    let isDynamic = false

    for (const segment of pathSegments) {
      // Catch-all: [...param] or [[...param]]
      const catchAllMatch = segment.match(/^\[{1,2}\.\.\.(\w+)\]{1,2}$/)
      if (catchAllMatch) {
        params.push(catchAllMatch[1])
        isDynamic = true
        continue
      }

      // Dynamic segment: [param]
      const dynamicMatch = segment.match(/^\[(\w+)\]$/)
      if (dynamicMatch) {
        params.push(dynamicMatch[1])
        isDynamic = true
      }
    }

    routes.push({
      urlPath: urlPath === '/' ? '/' : urlPath.replace(/\/$/, ''),
      filePath: file.relativePath,
      type,
      isDynamic,
      params,
    })
  }

  return routes
}

// ── Pages Router Detection ───────────────────────────────────────

function detectPagesRouterRoutes(files: ScannedFile[]): RouteEntry[] {
  const routes: RouteEntry[] = []

  for (const file of files) {
    const rel = file.relativePath.replace(/\\/g, '/')

    // Must be inside `pages/` directory
    if (!rel.startsWith('pages/')) continue

    const fileName = rel.split('/').pop() ?? ''
    const nameWithoutExt = fileName.replace(/\.(tsx?|jsx?)$/, '')

    // Skip internal Next.js files
    if (nameWithoutExt === '_app' || nameWithoutExt === '_document') continue

    // Determine type
    const isApi = rel.startsWith('pages/api/')
    const type: RouteEntry['type'] = isApi ? 'api' : 'page'

    // Build URL path
    // e.g. pages/dashboard/settings.tsx -> /dashboard/settings
    // e.g. pages/index.tsx -> /
    const withoutPages = rel.replace(/^pages\//, '')
    const withoutExt = withoutPages.replace(/\.(tsx?|jsx?)$/, '')

    let urlPath: string
    if (withoutExt === 'index') {
      urlPath = '/'
    } else if (withoutExt.endsWith('/index')) {
      urlPath = '/' + withoutExt.replace(/\/index$/, '')
    } else {
      urlPath = '/' + withoutExt
    }

    // Detect dynamic segments
    const params: string[] = []
    let isDynamic = false
    const segments = urlPath.split('/')

    for (const segment of segments) {
      // Catch-all: [...param]
      const catchAllMatch = segment.match(/^\[\.\.\.(\w+)\]$/)
      if (catchAllMatch) {
        params.push(catchAllMatch[1])
        isDynamic = true
        continue
      }

      // Dynamic segment: [param]
      const dynamicMatch = segment.match(/^\[(\w+)\]$/)
      if (dynamicMatch) {
        params.push(dynamicMatch[1])
        isDynamic = true
      }
    }

    routes.push({
      urlPath,
      filePath: file.relativePath,
      type,
      isDynamic,
      params,
    })
  }

  return routes
}

// ── Public API ───────────────────────────────────────────────────

export function detectRoutes(
  files: ScannedFile[],
  projectType: 'nextjs-app' | 'nextjs-pages',
): RouteEntry[] {
  if (projectType === 'nextjs-app') {
    return detectAppRouterRoutes(files)
  }
  return detectPagesRouterRoutes(files)
}
