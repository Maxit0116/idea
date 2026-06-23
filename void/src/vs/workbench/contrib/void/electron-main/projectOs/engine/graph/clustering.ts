import * as path from 'path'
import type { ScannedFile } from '../analyzer/file-scanner.js'
import type {
  FunctionalNode,
  RouteEntry,
  DependencyEntry,
  LinkedFile,
} from '../../../../common/projectOsTypes.js'

// ── Route Segment Name Mapping (Chinese) ────────────────────────

const SEGMENT_NAMES: Record<string, string> = {
  login: '用户登录',
  dashboard: '仪表盘',
  profile: '用户中心',
  settings: '设置',
  admin: '管理后台',
  home: '首页',
  about: '关于',
  pricing: '定价',
  blog: '博客',
  search: '搜索',
  cart: '购物车',
  checkout: '结算',
  notifications: '通知',
  chat: '聊天',
}

const SEGMENT_NAMES_EN: Record<string, string> = {
  login: 'User Login',
  dashboard: 'Dashboard',
  profile: 'User Profile',
  settings: 'Settings',
  admin: 'Admin Panel',
  home: 'Home',
  about: 'About',
  pricing: 'Pricing',
  blog: 'Blog',
  search: 'Search',
  cart: 'Shopping Cart',
  checkout: 'Checkout',
  notifications: 'Notifications',
  chat: 'Chat',
}

// ── Database-Related Patterns ───────────────────────────────────

const DB_PACKAGE_NAMES = new Set([
  'prisma',
  '@prisma/client',
  'mongoose',
  'drizzle-orm',
])

const DB_FILE_PATTERNS = [
  /prisma\//i,
  /\/db\//i,
  /\/database\//i,
  /\/models\//i,
  /\/schema\//i,
  /db\.(ts|js)$/i,
  /database\.(ts|js)$/i,
  /schema\.(ts|js)$/i,
]

// ── Internal Types ──────────────────────────────────────────────

interface Cluster {
  id: string
  segment: string
  name: string
  nameEn: string
  filePaths: Set<string>
  routeCount: number
  tags: string[]
}

// ── Strategy 1: Cluster by Page Routes ──────────────────────────

function clusterByRoutes(
  files: ScannedFile[],
  routes: RouteEntry[],
): Cluster[] {
  const pageRoutes = routes.filter((r) => r.type === 'page')
  const segmentMap = new Map<string, Cluster>()

  for (const route of pageRoutes) {
    // Extract first URL segment: /dashboard/settings -> "dashboard"
    const segments = route.urlPath.split('/').filter(Boolean)
    const firstSegment = segments[0] ?? 'home'

    // Skip dynamic-only top-level segments
    if (firstSegment.startsWith('[')) continue

    let cluster = segmentMap.get(firstSegment)
    if (!cluster) {
      cluster = {
        id: `feat_${firstSegment}`,
        segment: firstSegment,
        name: SEGMENT_NAMES[firstSegment] ?? firstSegment,
        nameEn: SEGMENT_NAMES_EN[firstSegment] ?? firstSegment,
        filePaths: new Set(),
        routeCount: 0,
        tags: ['page'],
      }
      segmentMap.set(firstSegment, cluster)
    }

    cluster.filePaths.add(route.filePath)
    cluster.routeCount++

    // Include sibling files in the same directory
    const routeDir = path.dirname(route.filePath).replace(/\\/g, '/')
    for (const file of files) {
      const fileDir = path.dirname(file.relativePath).replace(/\\/g, '/')
      if (fileDir === routeDir) {
        cluster.filePaths.add(file.relativePath)
      }
    }
  }

  return Array.from(segmentMap.values())
}

// ── Strategy 2: Attach API Routes ───────────────────────────────

function clusterByApiRoutes(
  clusters: Cluster[],
  routes: RouteEntry[],
): void {
  const apiRoutes = routes.filter((r) => r.type === 'api')

  for (const apiRoute of apiRoutes) {
    // Match API route to cluster by segment overlap
    // e.g. /api/dashboard/stats -> matches "dashboard" cluster
    const segments = apiRoute.urlPath
      .replace(/^\/api\/?/, '')
      .split('/')
      .filter(Boolean)

    for (const segment of segments) {
      const match = clusters.find(
        (c) => c.segment === segment || c.id === `feat_${segment}`,
      )
      if (match) {
        match.filePaths.add(apiRoute.filePath)
        if (!match.tags.includes('api')) {
          match.tags.push('api')
        }
        break
      }
    }
  }
}

// ── Strategy 3: Detect Database Cluster ─────────────────────────

function clusterByPackageDeps(
  files: ScannedFile[],
  packageDeps: Record<string, string>,
  clusters: Cluster[],
): void {
  const hasDbDep = Object.keys(packageDeps).some((dep) =>
    DB_PACKAGE_NAMES.has(dep),
  )
  if (!hasDbDep) return

  const dbCluster: Cluster = {
    id: 'feat_database',
    segment: 'database',
    name: '数据层',
    nameEn: 'Data Layer',
    filePaths: new Set(),
    routeCount: 0,
    tags: ['database', 'infrastructure'],
  }

  for (const file of files) {
    const relPath = file.relativePath.replace(/\\/g, '/')
    if (DB_FILE_PATTERNS.some((pattern) => pattern.test(relPath))) {
      dbCluster.filePaths.add(file.relativePath)
    }
  }

  if (dbCluster.filePaths.size > 0) {
    clusters.push(dbCluster)
  }
}

// ── Strategy 4: Attach Supporting Files ─────────────────────────

function attachSupportingFiles(
  clusters: Cluster[],
  dependencies: DependencyEntry[],
): void {
  const clusterByFile = new Map<string, Cluster>()
  for (const cluster of clusters) {
    for (const fp of cluster.filePaths) {
      clusterByFile.set(fp, cluster)
    }
  }

  // Pass 1: If a clustered file imports an unclustered file, attach the imported file
  for (const dep of dependencies) {
    const sourceCluster = clusterByFile.get(dep.source)
    const targetCluster = clusterByFile.get(dep.target)

    if (sourceCluster && !targetCluster) {
      sourceCluster.filePaths.add(dep.target)
      clusterByFile.set(dep.target, sourceCluster)
    }
  }

  // Pass 2: If an unclustered component imports a clustered file, attach the component
  for (const dep of dependencies) {
    const sourceCluster = clusterByFile.get(dep.source)
    const targetCluster = clusterByFile.get(dep.target)

    if (!sourceCluster && targetCluster) {
      targetCluster.filePaths.add(dep.source)
      clusterByFile.set(dep.source, targetCluster)
    }
  }
}

// ── Build FunctionalNode from Cluster ───────────────────────────

function clusterToNode(cluster: Cluster): FunctionalNode {
  const linkedFiles: LinkedFile[] = Array.from(cluster.filePaths).map(
    (fp) => ({
      path: fp,
      role: fp.includes('page.') || fp.includes('pages/')
        ? ('primary' as const)
        : ('supporting' as const),
    }),
  )

  const fileCount = cluster.filePaths.size
  const confidence = Math.min(0.95, 0.6 + fileCount * 0.05)

  return {
    id: cluster.id,
    type: 'capability',
    name: cluster.name,
    nameEn: cluster.nameEn,
    status: 'active',
    description: `${cluster.name} (${cluster.nameEn})`,
    summary: `包含 ${fileCount} 个文件，${cluster.routeCount} 条路由`,
    parentId: null,
    children: [],
    refs: [],
    depth: 0,
    linkedFiles,
    upstream: [],
    downstream: [],
    preview: cluster.routeCount > 0
      ? { route: `/${cluster.segment}`, thumbnail: null }
      : null,
    confidence,
    tags: cluster.tags,
  }
}

// ── Public API ──────────────────────────────────────────────────

export function clusterFiles(input: {
  files: ScannedFile[]
  routes: RouteEntry[]
  dependencies: DependencyEntry[]
  packageDeps: Record<string, string>
}): FunctionalNode[] {
  const { files, routes, dependencies, packageDeps } = input

  // Step 1: Cluster by page routes
  const clusters = clusterByRoutes(files, routes)

  // Step 2: Attach API route files to matching clusters
  clusterByApiRoutes(clusters, routes)

  // Step 3: Detect and add database cluster
  clusterByPackageDeps(files, packageDeps, clusters)

  // Step 4: Attach supporting files via dependency edges
  attachSupportingFiles(clusters, dependencies)

  // Convert clusters to FunctionalNode[]
  return clusters.map(clusterToNode)
}
