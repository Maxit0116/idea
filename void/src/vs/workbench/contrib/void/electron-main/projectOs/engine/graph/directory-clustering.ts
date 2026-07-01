import * as fs from 'fs/promises'
import * as path from 'path'
import type { ScannedFile } from '../analyzer/file-scanner.js'
import type { FunctionalNode, ProjectType } from '../../../../common/projectOsTypes.js'

// ── Display names for common directory segments ─────────────────

const DIR_NAMES: Record<string, { name: string; nameEn: string }> = {
	void: { name: 'Void / Project OS', nameEn: 'Void / Project OS' },
	files: { name: '文件管理', nameEn: 'File Explorer' },
	terminal: { name: '终端', nameEn: 'Terminal' },
	search: { name: '搜索', nameEn: 'Search' },
	debug: { name: '调试', nameEn: 'Debug' },
	scm: { name: '源代码管理', nameEn: 'Source Control' },
	extensions: { name: '扩展', nameEn: 'Extensions' },
	components: { name: '组件层', nameEn: 'Components' },
	services: { name: '服务层', nameEn: 'Services' },
	lib: { name: '核心库', nameEn: 'Core Library' },
	utils: { name: '工具函数', nameEn: 'Utilities' },
	hooks: { name: 'Hooks', nameEn: 'Hooks' },
	api: { name: 'API 层', nameEn: 'API Layer' },
	models: { name: '数据模型', nameEn: 'Models' },
	engine: { name: '引擎', nameEn: 'Engine' },
	common: { name: '公共模块', nameEn: 'Common' },
	browser: { name: '浏览器端', nameEn: 'Browser' },
	electron: { name: 'Electron 主进程', nameEn: 'Electron Main' },
	cli: { name: '命令行工具', nameEn: 'CLI' },
}

const MIN_FILES_PER_CLUSTER = 2
const MAX_CLUSTERS = 24

interface DirCluster {
	id: string
	segment: string
	name: string
	nameEn: string
	filePaths: Set<string>
	tags: string[]
}

// ── Helpers ─────────────────────────────────────────────────────

function humanizeDirName(segment: string): { name: string; nameEn: string } {
	const known = DIR_NAMES[segment.toLowerCase()]
	if (known) {
		return known
	}

	const title = segment
		.replace(/[-_]/g, ' ')
		.replace(/([a-z])([A-Z])/g, '$1 $2')
		.replace(/\b\w/g, c => c.toUpperCase())

	return { name: title, nameEn: title }
}

function isCodeFile(file: ScannedFile): boolean {
	return file.type !== 'asset' && file.type !== 'style' && file.type !== 'test'
}

function clusterToNode(cluster: DirCluster): FunctionalNode {
	const linkedFiles = Array.from(cluster.filePaths).map(fp => ({
		path: fp,
		role: (fp.includes('index.') || fp.endsWith('.ts') || fp.endsWith('.tsx'))
			? ('primary' as const)
			: ('supporting' as const),
	}))

	const fileCount = cluster.filePaths.size
	const confidence = Math.min(0.9, 0.55 + fileCount * 0.03)

	return {
		id: cluster.id,
		type: 'capability',
		name: cluster.name,
		nameEn: cluster.nameEn,
		status: 'active',
		description: `${cluster.name} (${cluster.nameEn})`,
		summary: `包含 ${fileCount} 个源文件`,
		parentId: null,
		children: [],
		refs: [],
		depth: 0,
		linkedFiles,
		upstream: [],
		downstream: [],
		preview: null,
		confidence,
		tags: cluster.tags,
	}
}

function addToCluster(
	map: Map<string, DirCluster>,
	key: string,
	segment: string,
	filePath: string,
	tags: string[],
): void {
	let cluster = map.get(key)
	if (!cluster) {
		const labels = humanizeDirName(segment)
		cluster = {
			id: `mod_${key.replace(/[^a-zA-Z0-9_]/g, '_')}`,
			segment,
			name: labels.name,
			nameEn: labels.nameEn,
			filePaths: new Set(),
			tags,
		}
		map.set(key, cluster)
	}
	cluster.filePaths.add(filePath)
}

function finalizeClusters(map: Map<string, DirCluster>): FunctionalNode[] {
	const clusters = Array.from(map.values())
		.filter(c => c.filePaths.size >= MIN_FILES_PER_CLUSTER)
		.sort((a, b) => b.filePaths.size - a.filePaths.size)
		.slice(0, MAX_CLUSTERS)

	// Attach orphan single-file dirs into a misc bucket if needed
	const usedPaths = new Set(clusters.flatMap(c => Array.from(c.filePaths)))
	const orphans = Array.from(map.values())
		.flatMap(c => Array.from(c.filePaths))
		.filter(p => !usedPaths.has(p))

	if (orphans.length >= MIN_FILES_PER_CLUSTER) {
		clusters.push({
			id: 'mod_misc',
			segment: 'misc',
			name: '其他模块',
			nameEn: 'Miscellaneous',
			filePaths: new Set(orphans.slice(0, 80)),
			tags: ['misc'],
		})
	}

	return clusters.map(clusterToNode)
}

// ── VS Code fork: contrib + services ────────────────────────────

function clusterVsCodeFork(files: ScannedFile[]): FunctionalNode[] {
	const map = new Map<string, DirCluster>()

	for (const file of files) {
		if (!isCodeFile(file)) continue
		const rel = file.relativePath.replace(/\\/g, '/')

		const contribMatch = rel.match(/^src\/vs\/workbench\/contrib\/([^/]+)/)
		if (contribMatch) {
			const segment = contribMatch[1]
			addToCluster(map, `contrib_${segment}`, segment, rel, ['contrib', 'vscode'])
			continue
		}

		const serviceMatch = rel.match(/^src\/vs\/workbench\/services\/([^/]+)/)
		if (serviceMatch) {
			const segment = serviceMatch[1]
			addToCluster(map, `service_${segment}`, segment, rel, ['service', 'vscode'])
			continue
		}

		const platformMatch = rel.match(/^src\/vs\/platform\/([^/]+)/)
		if (platformMatch) {
			const segment = platformMatch[1]
			addToCluster(map, `platform_${segment}`, segment, rel, ['platform', 'vscode'])
		}
	}

	const nodes = finalizeClusters(map)
	if (nodes.length > 0) {
		return nodes
	}

	return clusterByPathPrefix(files, ['src'], 3)
}

// ── Monorepo: packages/ or workspace roots ──────────────────────

async function clusterMonorepo(
	projectPath: string,
	files: ScannedFile[],
	pkg: { workspaces?: string[] | { packages: string[] } } | null,
): Promise<FunctionalNode[]> {
	const map = new Map<string, DirCluster>()

	// packages/foo, apps/bar
	for (const file of files) {
		if (!isCodeFile(file)) continue
		const rel = file.relativePath.replace(/\\/g, '/')

		const pkgMatch = rel.match(/^(?:packages|apps)\/([^/]+)/)
		if (pkgMatch) {
			const segment = pkgMatch[1]
			addToCluster(map, `pkg_${segment}`, segment, rel, ['package', 'monorepo'])
		}
	}

	if (map.size > 0) {
		return finalizeClusters(map)
	}

	// npm/yarn workspaces — resolve first-level workspace package names
	const workspaceDirs = await resolveWorkspacePackageDirs(projectPath, pkg)
	for (const file of files) {
		if (!isCodeFile(file)) continue
		const rel = file.relativePath.replace(/\\/g, '/')
		for (const wsDir of workspaceDirs) {
			if (rel === wsDir || rel.startsWith(wsDir + '/')) {
				const segment = wsDir.split('/').pop() ?? wsDir
				addToCluster(map, `ws_${segment}`, segment, rel, ['workspace', 'monorepo'])
				break
			}
		}
	}

	if (map.size > 0) {
		return finalizeClusters(map)
	}

	return clusterByPathPrefix(files, ['src', 'lib', 'packages'], 2)
}

async function resolveWorkspacePackageDirs(
	projectPath: string,
	pkg: { workspaces?: string[] | { packages: string[] } } | null,
): Promise<string[]> {
	const patterns: string[] = []
	if (!pkg?.workspaces) {
		return []
	}
	if (Array.isArray(pkg.workspaces)) {
		patterns.push(...pkg.workspaces)
	} else {
		patterns.push(...(pkg.workspaces.packages ?? []))
	}

	const dirs: string[] = []
	for (const pattern of patterns) {
		if (!pattern.includes('*')) {
			dirs.push(pattern.replace(/\/$/, ''))
			continue
		}
		const base = pattern.split('*')[0].replace(/\/$/, '')
		const basePath = path.join(projectPath, base)
		try {
			const entries = await fs.readdir(basePath, { withFileTypes: true })
			for (const entry of entries) {
				if (entry.isDirectory()) {
					dirs.push(path.join(base, entry.name).replace(/\\/g, '/'))
				}
			}
		} catch {
			// ignore
		}
	}
	return dirs
}

// ── Generic: src/lib top-level dirs ─────────────────────────────

function clusterBySrcTopLevel(files: ScannedFile[]): FunctionalNode[] {
	const map = new Map<string, DirCluster>()

	for (const file of files) {
		if (!isCodeFile(file)) continue
		const rel = file.relativePath.replace(/\\/g, '/')

		const srcMatch = rel.match(/^(?:src|lib)\/([^/]+)/)
		if (srcMatch) {
			const segment = srcMatch[1]
			addToCluster(map, `src_${segment}`, segment, rel, ['module'])
			continue
		}

		// Top-level dirs with code (e.g. components/, server/)
		const topMatch = rel.match(/^([^/]+)\//)
		if (topMatch) {
			const segment = topMatch[1]
			if (!['node_modules', 'public', 'assets', 'docs', 'scripts'].includes(segment)) {
				addToCluster(map, `top_${segment}`, segment, rel, ['module'])
			}
		}
	}

	const nodes = finalizeClusters(map)
	if (nodes.length > 0) {
		return nodes
	}

	return clusterByPathPrefix(files, ['src', 'lib', 'app', 'server', 'client'], 2)
}

function clusterByPathPrefix(
	files: ScannedFile[],
	roots: string[],
	depth: number,
): FunctionalNode[] {
	const map = new Map<string, DirCluster>()

	for (const file of files) {
		if (!isCodeFile(file)) continue
		const rel = file.relativePath.replace(/\\/g, '/')
		const parts = rel.split('/')

		let startIdx = 0
		if (roots.includes(parts[0])) {
			startIdx = 1
		}

		if (parts.length <= startIdx) continue
		const segments = parts.slice(startIdx, startIdx + depth)
		if (segments.length === 0) continue

		const key = segments.join('/')
		const segment = segments[segments.length - 1]
		addToCluster(map, `path_${key.replace(/\//g, '_')}`, segment, rel, ['module'])
	}

	return finalizeClusters(map)
}

// ── Public API ──────────────────────────────────────────────────

export async function clusterByDirectoryStructure(input: {
	projectPath: string
	projectType: ProjectType
	files: ScannedFile[]
	packageJson: { workspaces?: string[] | { packages: string[] } } | null
}): Promise<FunctionalNode[]> {
	const { projectPath, projectType, files, packageJson } = input

	switch (projectType) {
		case 'vscode-fork':
			return clusterVsCodeFork(files)
		case 'monorepo':
			return clusterMonorepo(projectPath, files, packageJson)
		case 'react-spa':
		case 'generic':
		default:
			return clusterBySrcTopLevel(files)
	}
}
