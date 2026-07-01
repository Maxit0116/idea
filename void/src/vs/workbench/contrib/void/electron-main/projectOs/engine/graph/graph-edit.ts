/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import type {
	ArchitectureGuardMode,
	GraphEdit,
	GraphChangelogEntry,
	GuardSeverity,
	ProjectGraph,
	ValidateEditResponse,
} from '../../../../common/projectOsTypes.js';
import { computeTopologyMeta } from './topology-hierarchy.js';
import { appendChangelog } from './graph-changelog.js';
import { defaultLineage, slugify } from './node-id.js';

function localSeverity(edit: GraphEdit): GuardSeverity {
	switch (edit.type) {
		case 'rename':
			return 'warning';
		case 'merge':
		case 'delete':
		case 'reparent':
			return 'critical';
		default:
			return 'warning';
	}
}

export function localValidateEdit(graph: ProjectGraph, edit: GraphEdit): ValidateEditResponse {
	const severity = localSeverity(edit);
	const impacts: string[] = [];
	const node = graph.nodes.find(n => n.id === edit.nodeId);

	if (!node && edit.type !== 'merge') {
		return { allowed: false, severity: 'critical', impacts: ['Node not found'], alternatives: [] };
	}

	if (edit.type === 'delete' && node) {
		const childCount = graph.nodes.filter(n => n.parentId === node.id).length;
		if (childCount > 0) {
			impacts.push(`Will orphan ${childCount} child nodes`);
		}
		impacts.push('Chat threads bound to this node may lose context');
	}

	if (edit.type === 'merge' && edit.targetNodeId) {
		const target = graph.nodes.find(n => n.id === edit.targetNodeId);
		if (!target) {
			return { allowed: false, severity: 'critical', impacts: ['Merge target not found'], alternatives: [] };
		}
		impacts.push(`Files from "${node?.name}" will merge into "${target.name}"`);
	}

	if (edit.type === 'reparent' && edit.newParentId) {
		const newParent = graph.nodes.find(n => n.id === edit.newParentId);
		if (!newParent) {
			return { allowed: false, severity: 'critical', impacts: ['New parent not found'], alternatives: [] };
		}
		if (edit.newParentId === edit.nodeId) {
			return { allowed: false, severity: 'critical', impacts: ['Cannot parent node to itself'], alternatives: [] };
		}
		impacts.push(`"${node?.name}" will move under "${newParent.name}"`);
	}

	const allowed = severity !== 'critical' || edit.type === 'rename';
	return { allowed, severity, impacts, alternatives: [] };
}

export function applyGraphEdit(
	graph: ProjectGraph,
	edit: GraphEdit,
): { graph: ProjectGraph; changelog: GraphChangelogEntry } {
	const changelog: GraphChangelogEntry = {
		at: new Date().toISOString(),
		fromId: edit.nodeId,
		toId: edit.nodeId,
		reason: 'user_edit',
		note: edit.type,
	};

	let nodes = [...graph.nodes];

	switch (edit.type) {
		case 'rename': {
			nodes = nodes.map(n => n.id === edit.nodeId
				? {
					...n,
					name: edit.name ?? n.name,
					nameEn: edit.nameEn ?? n.nameEn,
					lineage: {
						...(n.lineage ?? defaultLineage(n.id, 'user')),
						slug: edit.name ? slugify(edit.name) : (n.lineage?.slug ?? slugify(n.name)),
					},
				}
				: n);
			break;
		}
		case 'delete': {
			nodes = nodes.filter(n => n.id !== edit.nodeId);
			nodes = nodes.map(n => ({
				...n,
				parentId: n.parentId === edit.nodeId ? null : n.parentId,
				children: n.children.filter(c => c !== edit.nodeId),
				upstream: n.upstream.filter(id => id !== edit.nodeId),
				downstream: n.downstream.filter(id => id !== edit.nodeId),
			}));
			changelog.note = `Deleted node ${edit.nodeId}`;
			break;
		}
		case 'reparent': {
			if (!edit.newParentId) {
				break;
			}
			nodes = nodes.map(n => n.id === edit.nodeId
				? { ...n, parentId: edit.newParentId! }
				: n);
			// fix children arrays
			for (const n of nodes) {
				const kids = nodes.filter(c => c.parentId === n.id).map(c => c.id);
				n.children = kids;
			}
			changelog.note = `Reparented to ${edit.newParentId}`;
			break;
		}
		case 'merge': {
			if (!edit.targetNodeId) {
				break;
			}
			const source = nodes.find(n => n.id === edit.nodeId);
			const target = nodes.find(n => n.id === edit.targetNodeId);
			if (!source || !target) {
				break;
			}
			const mergedFiles = [...target.linkedFiles];
			for (const f of source.linkedFiles) {
				if (!mergedFiles.some(m => m.path === f.path)) {
					mergedFiles.push(f);
				}
			}
			const mergedAnchors = [...(target.anchors ?? [])];
			for (const a of source.anchors ?? []) {
				if (!mergedAnchors.some(m => m.path === a.path && m.startLine === a.startLine)) {
					mergedAnchors.push(a);
				}
			}
			nodes = nodes
				.filter(n => n.id !== edit.nodeId)
				.map(n => n.id === edit.targetNodeId
					? {
						...n,
						linkedFiles: mergedFiles,
						anchors: mergedAnchors,
						lineage: {
							...(n.lineage ?? defaultLineage(n.id, 'user')),
							aliases: [...new Set([...(n.lineage?.aliases ?? []), source.id])],
						},
					}
					: {
						...n,
						parentId: n.parentId === edit.nodeId ? edit.targetNodeId : n.parentId,
						children: n.children.map(c => c === edit.nodeId ? edit.targetNodeId! : c).filter(c => c !== edit.nodeId),
					});
			changelog.fromId = source.id;
			changelog.toId = target.id;
			changelog.reason = 'merge';
			break;
		}
		case 'update_anchors': {
			nodes = nodes.map(n => n.id === edit.nodeId
				? { ...n, anchors: edit.anchors ?? n.anchors }
				: n);
			break;
		}
	}

	const updated: ProjectGraph = {
		...graph,
		version: '0.3.0',
		nodes,
		topology: computeTopologyMeta(nodes),
		analyzedAt: new Date().toISOString(),
	};

	return { graph: updated, changelog };
}

export function shouldBlockEdit(
	validation: ValidateEditResponse,
	guardMode: ArchitectureGuardMode,
	edit: GraphEdit,
): boolean {
	if (guardMode === 'off') {
		return false;
	}
	const p0 = edit.type === 'merge' || edit.type === 'delete' || edit.type === 'reparent';
	if (p0 && validation.severity === 'critical') {
		return guardMode === 'block';
	}
	if (!validation.allowed && guardMode === 'block') {
		return true;
	}
	return false;
}

export async function persistGraphEdit(
	projectPath: string,
	graph: ProjectGraph,
	changelog: GraphChangelogEntry,
): Promise<void> {
	await appendChangelog(projectPath, changelog);
}
