/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import type { FunctionalNode, ProjectGraph } from '../../../../common/projectOsTypes.js';
import { defaultLineage, inferGranularityFromDepth } from './node-id.js';

export function normalizeNode(node: FunctionalNode): FunctionalNode {
	const granularity = node.granularity ?? inferGranularityFromDepth(node.depth, node.id);
	const lineage = node.lineage ?? defaultLineage(node.id, node.id.startsWith('static_') ? 'static' : 'ai');
	return {
		...node,
		anchors: node.anchors ?? [],
		granularity,
		lineage,
		crossRefs: node.crossRefs ?? [],
	};
}

/** Upgrade 0.2.0 graphs to 0.3.0 in memory */
export function migrateGraph(graph: ProjectGraph): ProjectGraph {
	const version = graph.version ?? '0.2.0';
	if (version === '0.3.0') {
		return {
			...graph,
			nodes: graph.nodes.map(normalizeNode),
		};
	}
	return {
		...graph,
		version: '0.3.0',
		nodes: graph.nodes.map(normalizeNode),
	};
}
