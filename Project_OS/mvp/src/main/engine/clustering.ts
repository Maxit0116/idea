import type { ScannedFile } from './file-scanner'
import type { RouteEntry, DependencyEntry, FunctionalNode, LinkedFile } from '../../shared/types'
import { v4 as uuid } from 'uuid'

interface ClusterInput {
  files: ScannedFile[]
  routes: RouteEntry[]
  dependencies: DependencyEntry[]
  packageDeps: Record<string, string>
}

interface FileCluster {
  id: string
  name: string
  nameEn: string
  description: string
  files: ScannedFile[]
  routes: RouteEntry[]
  confidence: number
  tags: string[]
}

const ROUTE_NAMES: Record<string, { cn: string; en: string; desc: string; tags: string[] }> = {
  login: { cn: '用户登录', en: 'Login', desc: '用户登录页面与认证逻辑', tags: ['auth', 'login'] },
  signin: { cn: '用户登录', en: 'Sign In', desc: '用户登录页面', tags: ['auth', 'login'] },
  signup: { cn: '用户注册', en: 'Sign Up', desc: '新用户注册功能', tags: ['auth', 'register'] },
  register: { cn: '用户注册', en: 'Register', desc: '新用户注册功能', tags: ['auth', 'register'] },
  auth: { cn: '用户认证', en: 'Authentication', desc: '身份验证与会话管理', tags: ['auth', 'session'] },
  dashboard: { cn: '仪表盘', en: 'Dashboard', desc: '主面板，展示关键数据概览', tags: ['dashboard', 'home'] },
  profile: { cn: '用户中心', en: 'User Profile', desc: '个人信息展示与编辑', tags: ['profile', 'user'] },
  settings: { cn: '设置', en: 'Settings', desc: '应用设置与偏好管理', tags: ['settings', 'preferences'] },
  admin: { cn: '管理后台', en: 'Admin Panel', desc: '系统管理功能', tags: ['admin', 'management'] },
  home: { cn: '首页', en: 'Home', desc: '应用首页', tags: ['home', 'landing'] },
  about: { cn: '关于', en: 'About', desc: '关于页面', tags: ['about', 'info'] },
  pricing: { cn: '定价', en: 'Pricing', desc: '产品定价与套餐', tags: ['pricing', 'billing'] },
  checkout: { cn: '结算', en: 'Checkout', desc: '订单结算与支付', tags: ['checkout', 'payment'] },
  cart: { cn: '购物车', en: 'Cart', desc: '购物车功能', tags: ['cart', 'shopping'] },
  blog: { cn: '博客', en: 'Blog', desc: '博客内容展示', tags: ['blog', 'content'] },
  contact: { cn: '联系', en: 'Contact', desc: '联系方式与表单', tags: ['contact'] },
  search: { cn: '搜索', en: 'Search', desc: '搜索功能', tags: ['search'] },
  notifications: { cn: '通知', en: 'Notifications', desc: '消息通知中心', tags: ['notifications'] },
  chat: { cn: '聊天', en: 'Chat', desc: '即时通讯功能', tags: ['chat', 'messaging'] },
}

export function clusterFiles(input: ClusterInput): FunctionalNode[] {
  const clusters = new Map<string, FileCluster>()
  const assignedFiles = new Set<string>()

  clusterByRoutes(input, clusters, assignedFiles)
  clusterByApiRoutes(input, clusters, assignedFiles)
  clusterByDirectory(input, clusters, assignedFiles)
  clusterByPackageDeps(input, clusters, assignedFiles)
  attachSupportingFiles(input, clusters, assignedFiles)

  return Array.from(clusters.values()).map(clusterToNode)
}

function clusterByRoutes(
  input: ClusterInput,
  clusters: Map<string, FileCluster>,
  assigned: Set<string>
): void {
  const pageRoutes = input.routes.filter((r) => r.type === 'page')

  for (const route of pageRoutes) {
    const segment = extractRouteSegment(route.urlPath)
    if (!segment) continue

    const known = ROUTE_NAMES[segment.toLowerCase()]
    const id = `feat_${segment.toLowerCase().replace(/[^a-z0-9]/g, '_')}`

    if (!clusters.has(id)) {
      clusters.set(id, {
        id,
        name: known?.cn || capitalize(segment),
        nameEn: known?.en || capitalize(segment),
        description: known?.desc || `${capitalize(segment)} 功能页面`,
        files: [],
        routes: [],
        confidence: known ? 0.9 : 0.75,
        tags: known?.tags || [segment.toLowerCase()]
      })
    }

    const cluster = clusters.get(id)!
    cluster.routes.push(route)

    const routeFile = input.files.find((f) => f.relativePath === route.filePath)
    if (routeFile && !assigned.has(routeFile.relativePath)) {
      cluster.files.push(routeFile)
      assigned.add(routeFile.relativePath)
    }

    const dirFiles = findSiblingFiles(input.files, route.filePath)
    for (const f of dirFiles) {
      if (!assigned.has(f.relativePath)) {
        cluster.files.push(f)
        assigned.add(f.relativePath)
      }
    }
  }
}

function clusterByApiRoutes(
  input: ClusterInput,
  clusters: Map<string, FileCluster>,
  assigned: Set<string>
): void {
  const apiRoutes = input.routes.filter((r) => r.type === 'api')

  for (const route of apiRoutes) {
    const apiFile = input.files.find((f) => f.relativePath === route.filePath)
    if (!apiFile || assigned.has(apiFile.relativePath)) continue

    const segment = extractApiSegment(route.urlPath)
    const matchingCluster = findClusterForApi(segment, clusters)

    if (matchingCluster) {
      matchingCluster.files.push(apiFile)
      matchingCluster.routes.push(route)
      assigned.add(apiFile.relativePath)
    }
  }
}

function clusterByDirectory(
  input: ClusterInput,
  clusters: Map<string, FileCluster>,
  assigned: Set<string>
): void {
  const libFiles = input.files.filter(
    (f) => !assigned.has(f.relativePath) && (f.type === 'lib' || f.type === 'config')
  )

  const dirGroups = new Map<string, ScannedFile[]>()
  for (const file of libFiles) {
    const parts = file.relativePath.split('/')
    if (parts.length >= 2) {
      const dir = parts.slice(0, 2).join('/')
      if (!dirGroups.has(dir)) dirGroups.set(dir, [])
      dirGroups.get(dir)!.push(file)
    }
  }

  for (const [dir, files] of dirGroups) {
    if (files.length < 2) continue

    const dirName = dir.split('/').pop()!
    const id = `feat_${dirName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`

    if (clusters.has(id)) {
      for (const f of files) {
        if (!assigned.has(f.relativePath)) {
          clusters.get(id)!.files.push(f)
          assigned.add(f.relativePath)
        }
      }
    }
  }
}

function clusterByPackageDeps(
  input: ClusterInput,
  clusters: Map<string, FileCluster>,
  assigned: Set<string>
): void {
  const deps = input.packageDeps

  if (deps['prisma'] || deps['@prisma/client'] || deps['mongoose'] || deps['drizzle-orm'] || deps['knex']) {
    const dbFiles = input.files.filter(
      (f) =>
        !assigned.has(f.relativePath) &&
        (f.relativePath.includes('prisma') ||
          f.relativePath.includes('db') ||
          f.relativePath.includes('database') ||
          f.relativePath.includes('models') ||
          f.relativePath.includes('schema.prisma'))
    )

    if (dbFiles.length > 0) {
      const id = 'feat_database'
      clusters.set(id, {
        id,
        name: '数据管理',
        nameEn: 'Database',
        description: '数据库连接与数据模型管理',
        files: dbFiles,
        routes: [],
        confidence: 0.9,
        tags: ['database', 'data', 'models']
      })
      dbFiles.forEach((f) => assigned.add(f.relativePath))
    }
  }
}

function attachSupportingFiles(
  input: ClusterInput,
  clusters: Map<string, FileCluster>,
  assigned: Set<string>
): void {
  for (const dep of input.dependencies) {
    if (assigned.has(dep.source) && !assigned.has(dep.target)) {
      const sourceCluster = Array.from(clusters.values()).find((c) =>
        c.files.some((f) => f.relativePath === dep.source)
      )
      const targetFile = input.files.find((f) => f.relativePath === dep.target)

      if (sourceCluster && targetFile) {
        sourceCluster.files.push(targetFile)
        assigned.add(dep.target)
      }
    }
  }

  for (const dep of input.dependencies) {
    if (!assigned.has(dep.source) && assigned.has(dep.target)) {
      const targetCluster = Array.from(clusters.values()).find((c) =>
        c.files.some((f) => f.relativePath === dep.target)
      )
      const sourceFile = input.files.find((f) => f.relativePath === dep.source)

      if (targetCluster && sourceFile && sourceFile.type === 'component') {
        targetCluster.files.push(sourceFile)
        assigned.add(dep.source)
      }
    }
  }
}

function clusterToNode(cluster: FileCluster): FunctionalNode {
  const linkedFiles: LinkedFile[] = cluster.files.map((f) => ({
    path: f.relativePath,
    role: f.type === 'page' || f.type === 'api' ? 'primary' as const :
          f.type === 'config' ? 'config' as const :
          f.type === 'test' ? 'test' as const : 'supporting' as const,
    summary: summarizeFileRole(f)
  }))

  const primaryRoute = cluster.routes.find((r) => r.type === 'page')

  return {
    id: cluster.id,
    type: 'capability',
    name: cluster.name,
    nameEn: cluster.nameEn,
    status: 'active',
    description: cluster.description,
    summary: buildSummary(cluster),
    linkedFiles,
    upstream: [],
    downstream: [],
    preview: primaryRoute ? { route: primaryRoute.urlPath, thumbnail: null } : null,
    confidence: cluster.confidence,
    tags: cluster.tags
  }
}

function extractRouteSegment(urlPath: string): string | null {
  const parts = urlPath.split('/').filter(Boolean)
  if (parts.length === 0) return 'home'
  const first = parts[0].replace(/\[.*\]/, '')
  return first || null
}

function extractApiSegment(urlPath: string): string {
  const parts = urlPath.replace(/^\/api\/?/, '').split('/').filter(Boolean)
  return parts[0]?.replace(/\[.*\]/, '') || 'api'
}

function findClusterForApi(apiSegment: string, clusters: Map<string, FileCluster>): FileCluster | undefined {
  for (const [, cluster] of clusters) {
    if (cluster.tags.some((t) => apiSegment.toLowerCase().includes(t))) {
      return cluster
    }
    if (cluster.id.includes(apiSegment.toLowerCase())) {
      return cluster
    }
  }
  return undefined
}

function findSiblingFiles(files: ScannedFile[], filePath: string): ScannedFile[] {
  const dir = filePath.replace(/\/[^/]+$/, '')
  return files.filter(
    (f) =>
      f.relativePath.startsWith(dir + '/') &&
      f.relativePath !== filePath &&
      !f.relativePath.slice(dir.length + 1).includes('/')
  )
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function summarizeFileRole(f: ScannedFile): string {
  const name = f.relativePath.split('/').pop() || ''
  switch (f.type) {
    case 'page': return `${name} 页面`
    case 'api': return `${name} API 路由`
    case 'component': return `${name} 组件`
    case 'lib': return `${name} 工具库`
    case 'config': return `${name} 配置`
    case 'style': return `${name} 样式`
    case 'test': return `${name} 测试`
    default: return name
  }
}

function buildSummary(cluster: FileCluster): string {
  const pageCount = cluster.files.filter((f) => f.type === 'page').length
  const apiCount = cluster.files.filter((f) => f.type === 'api').length
  const compCount = cluster.files.filter((f) => f.type === 'component').length

  const parts: string[] = [cluster.description + '。']
  if (pageCount > 0) parts.push(`包含 ${pageCount} 个页面`)
  if (apiCount > 0) parts.push(`${apiCount} 个 API 路由`)
  if (compCount > 0) parts.push(`${compCount} 个组件`)
  parts.push(`共 ${cluster.files.length} 个文件。`)

  const routes = cluster.routes.filter((r) => r.type === 'page')
  if (routes.length > 0) {
    parts.push(`路由: ${routes.map((r) => r.urlPath).join(', ')}`)
  }

  return parts.join('，').replace(/，。/g, '。').replace(/，共/, '，共')
}
