import type { ScannedFile } from './file-scanner'
import type { RouteEntry } from '../../shared/types'

export function detectRoutes(files: ScannedFile[], projectType: 'nextjs-app' | 'nextjs-pages'): RouteEntry[] {
  if (projectType === 'nextjs-app') {
    return detectAppRouterRoutes(files)
  }
  return detectPagesRouterRoutes(files)
}

function detectAppRouterRoutes(files: ScannedFile[]): RouteEntry[] {
  const routes: RouteEntry[] = []

  for (const file of files) {
    const p = file.relativePath.replace(/\\/g, '/')

    const appMatch = p.match(/^(?:src\/)?app\/(.*)$/)
    if (!appMatch) continue

    const rest = appMatch[1]

    let routeType: RouteEntry['type'] | null = null
    if (rest.match(/page\.(tsx?|jsx?)$/)) routeType = 'page'
    else if (rest.match(/route\.(tsx?|jsx?)$/)) routeType = 'api'
    else if (rest.match(/layout\.(tsx?|jsx?)$/)) routeType = 'layout'
    else if (rest.match(/loading\.(tsx?|jsx?)$/)) routeType = 'loading'
    else if (rest.match(/error\.(tsx?|jsx?)$/)) routeType = 'error'
    else if (rest === 'middleware.ts' || rest === 'middleware.js') routeType = 'middleware'

    if (!routeType) continue

    const dirPart = rest.replace(/\/?(page|route|layout|loading|error|middleware)\.(tsx?|jsx?)$/, '')
    let urlPath = '/' + dirPart.replace(/\/+$/, '')
    if (urlPath === '/') urlPath = '/'

    const params: string[] = []
    const isDynamic = urlPath.includes('[')
    const dynamicMatches = urlPath.match(/\[([^\]]+)\]/g)
    if (dynamicMatches) {
      for (const m of dynamicMatches) {
        params.push(m.replace(/[[\]\.]/g, ''))
      }
    }

    if (routeType === 'api') {
      urlPath = urlPath.startsWith('/api') ? urlPath : '/api' + urlPath
    }

    routes.push({
      urlPath,
      filePath: file.relativePath,
      type: routeType,
      isDynamic,
      params
    })
  }

  return routes
}

function detectPagesRouterRoutes(files: ScannedFile[]): RouteEntry[] {
  const routes: RouteEntry[] = []

  for (const file of files) {
    const p = file.relativePath.replace(/\\/g, '/')

    const pagesMatch = p.match(/^(?:src\/)?pages\/(.*)$/)
    if (!pagesMatch) continue

    const rest = pagesMatch[1]
    if (rest.startsWith('_')) continue

    const isApi = rest.startsWith('api/')
    const routeType: RouteEntry['type'] = isApi ? 'api' : 'page'

    let urlPath = '/' + rest.replace(/\.(tsx?|jsx?)$/, '').replace(/\/index$/, '')
    if (urlPath === '/') urlPath = '/'

    const params: string[] = []
    const isDynamic = urlPath.includes('[')
    const dynamicMatches = urlPath.match(/\[([^\]]+)\]/g)
    if (dynamicMatches) {
      for (const m of dynamicMatches) {
        params.push(m.replace(/[[\]\.]/g, ''))
      }
    }

    routes.push({
      urlPath,
      filePath: file.relativePath,
      type: routeType,
      isDynamic,
      params
    })
  }

  return routes
}
