import * as fs from 'fs/promises'
import * as path from 'path'
import type { ProjectType } from '../../../../common/projectOsTypes.js'
import type { ScannedFile } from './file-scanner.js'

interface PackageJson {
	name?: string
	dependencies?: Record<string, string>
	devDependencies?: Record<string, string>
	workspaces?: string[] | { packages: string[] }
}

export async function detectProjectType(
	projectPath: string,
	pkg: PackageJson | null,
	files: ScannedFile[],
): Promise<ProjectType> {
	const allDeps = {
		...(pkg?.dependencies ?? {}),
		...(pkg?.devDependencies ?? {}),
	}

	if (hasWorkspaces(pkg)) {
		return 'monorepo'
	}

	const normalizedPaths = files.map(f => f.relativePath.replace(/\\/g, '/'))

	if (normalizedPaths.some(p => p.startsWith('src/vs/workbench/contrib/'))) {
		return 'vscode-fork'
	}

	if (allDeps['next']) {
		try {
			const stat = await fs.stat(path.join(projectPath, 'app'))
			if (stat.isDirectory()) {
				return 'nextjs-app'
			}
		} catch {
			// not app router
		}

		try {
			const stat = await fs.stat(path.join(projectPath, 'pages'))
			if (stat.isDirectory()) {
				return 'nextjs-pages'
			}
		} catch {
			// not pages router
		}

		return 'nextjs-app'
	}

	if (
		allDeps['react'] ||
		allDeps['react-dom'] ||
		allDeps['vite'] ||
		allDeps['@vitejs/plugin-react']
	) {
		return 'react-spa'
	}

	if (normalizedPaths.some(p => p.startsWith('packages/'))) {
		return 'monorepo'
	}

	return 'generic'
}

function hasWorkspaces(pkg: PackageJson | null): boolean {
	if (!pkg?.workspaces) {
		return false
	}
	if (Array.isArray(pkg.workspaces)) {
		return pkg.workspaces.length > 0
	}
	return (pkg.workspaces.packages?.length ?? 0) > 0
}
