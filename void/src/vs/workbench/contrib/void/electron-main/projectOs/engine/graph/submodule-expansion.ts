/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------
 *
 * Expand feature modules into subdirectory sub-nodes so drill-down navigation
 * has a real child topology (browser / common / electron-main, etc.).
 */

import type { FunctionalNode, LinkedFile } from '../../../../common/projectOsTypes.js';

const ROOT_ID = 'sys_root';
const MIN_FILES_PER_SUB = 2;
const MIN_TOTAL_FILES = 4;
const MAX_SUBMODULES = 20;

const SEGMENT_NAMES: Record<string, { name: string; nameEn: string }> = {
	browser: { name: '浏览器端', nameEn: 'Browser' },
	'electron-main': { name: 'Electron 主进程', nameEn: 'Electron Main' },
	common: { name: '公共模块', nameEn: 'Common' },
	components: { name: '组件层', nameEn: 'Components' },
	services: { name: '服务层', nameEn: 'Services' },
	api: { name: 'API 层', nameEn: 'API Layer' },
	lib: { name: '核心库', nameEn: 'Core Library' },
	hooks: { name: 'Hooks', nameEn: 'Hooks' },
	utils: { name: '工具函数', nameEn: 'Utilities' },
	models: { name: '数据模型', nameEn: 'Models' },
	engine: { name: '引擎', nameEn: 'Engine' },
	react: { name: 'React UI', nameEn: 'React UI' },
	app: { name: '应用层', nameEn: 'App' },
	pages: { name: '页面', nameEn: 'Pages' },
	routes: { name: '路由', nameEn: 'Routes' },
};

function humanizeSegment(segment: string): { name: string; nameEn: string } {
	const known = SEGMENT_NAMES[segment.toLowerCase()];
	if (known) {
		return known;
	}
	const title = segment
		.replace(/[-_]/g, ' ')
		.replace(/([a-z])([A-Z])/g, '$1 $2')
		.replace(/\b\w/g, c => c.toUpperCase());
	return { name: title, nameEn: title };
}

function longestCommonDirDepth(paths: string[]): number {
	if (paths.length === 0) {
		return 0;
	}
	const split = paths.map(p => p.split('/'));
	const max = Math.min(...split.map(p => p.length)) - 1;
	let depth = 0;
	for (let i = 0; i < max; i++) {
		const seg = split[0]![i];
		if (split.every(parts => parts[i] === seg)) {
			depth = i + 1;
		} else {
			break;
		}
	}
	return depth;
}

function clusterLinkedFiles(parent: FunctionalNode): FunctionalNode[] {
	if (parent.linkedFiles.length < MIN_TOTAL_FILES) {
		return [];
	}

	const paths = parent.linkedFiles.map(f => f.path.replace(/\\/g, '/'));
	const clusterDepth = longestCommonDirDepth(paths);

	const groups = new Map<string, LinkedFile[]>();
	for (const lf of parent.linkedFiles) {
		const parts = lf.path.replace(/\\/g, '/').split('/');
		const seg = parts[clusterDepth];
		const key = seg ?? '_direct';
		const bucket = groups.get(key) ?? [];
		bucket.push(lf);
		groups.set(key, bucket);
	}

	const eligible = Array.from(groups.entries())
		.filter(([, files]) => files.length >= MIN_FILES_PER_SUB)
		.sort((a, b) => b[1].length - a[1].length)
		.slice(0, MAX_SUBMODULES);

	if (eligible.length < 2) {
		return [];
	}

	return eligible.map(([segment, files]) => {
		const labels = segment === '_direct'
			? { name: '根目录文件', nameEn: 'Root Files' }
			: humanizeSegment(segment);
		const id = `${parent.id}::sub::${segment.replace(/[^a-zA-Z0-9_]/g, '_')}`;
		return {
			id,
			type: 'capability' as const,
			name: labels.name,
			nameEn: labels.nameEn,
			status: parent.status,
			description: `${labels.name}（${parent.name} 子模块）`,
			summary: `包含 ${files.length} 个源文件`,
			parentId: parent.id,
			children: [],
			refs: [],
			depth: parent.depth + 1,
			linkedFiles: files,
			upstream: [],
			downstream: [],
			preview: null,
			confidence: Math.min(0.85, 0.5 + files.length * 0.02),
			tags: ['submodule', segment === '_direct' ? 'root' : segment],
		};
	});
}

/**
 * Add subdirectory sub-nodes under modules that have linked files but no children yet.
 */
export function expandSubmoduleNodes(nodes: FunctionalNode[]): FunctionalNode[] {
	const result = [...nodes];
	const childrenByParent = new Map<string, string[]>();

	for (const node of nodes) {
		if (node.parentId) {
			const list = childrenByParent.get(node.parentId) ?? [];
			list.push(node.id);
			childrenByParent.set(node.parentId, list);
		}
	}

	const additions: FunctionalNode[] = [];
	for (const node of nodes) {
		if (node.id === ROOT_ID) {
			continue;
		}
		if ((childrenByParent.get(node.id)?.length ?? node.children.length) > 0) {
			continue;
		}
		const subs = clusterLinkedFiles(node);
		if (subs.length === 0) {
			continue;
		}
		additions.push(...subs);
	}

	if (additions.length === 0) {
		return result;
	}

	result.push(...additions);

	for (const node of result) {
		const childIds = result
			.filter(n => n.parentId === node.id)
			.map(n => n.id);
		if (childIds.length > 0) {
			const idx = result.findIndex(n => n.id === node.id);
			if (idx >= 0) {
				result[idx] = { ...result[idx]!, children: childIds };
			}
		}
	}

	return result;
}
