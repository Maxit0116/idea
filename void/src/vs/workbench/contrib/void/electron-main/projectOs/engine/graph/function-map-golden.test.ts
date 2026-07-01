/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../../base/test/common/utils.js';
import { enrichTopology } from './topology-hierarchy.js';
import { isStaleFunctionMapGraph } from '../../../../common/projectOsTypes.js';
import type { FunctionalNode } from '../../../../common/projectOsTypes.js';

function makeFeatureNode(id: string, parentId: string | null, name: string): FunctionalNode {
	return {
		id,
		type: 'capability',
		name,
		nameEn: name,
		status: 'active',
		description: '',
		summary: '',
		parentId,
		children: [],
		refs: [],
		depth: 0,
		linkedFiles: [],
		upstream: [],
		downstream: [],
		preview: null,
		confidence: 1,
		tags: [],
	};
}

suite('Function Map golden', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('enrichTopology preserveHierarchy keeps AI parent chain', () => {
		const parent = makeFeatureNode('feat_parent_abcd', 'sys_root', '功能地图');
		const child = makeFeatureNode('feat_child_efgh', 'feat_parent_abcd', '分析引擎');
		child.parentId = 'feat_parent_abcd';

		const enriched = enrichTopology([parent, child], [], 'void', { preserveHierarchy: true });
		const childOut = enriched.find(n => n.id === 'feat_child_efgh');
		const parentOut = enriched.find(n => n.id === 'feat_parent_abcd');

		assert.ok(childOut);
		assert.ok(parentOut);
		assert.strictEqual(childOut!.parentId, 'feat_parent_abcd');
		assert.strictEqual(childOut!.depth, 2);
		assert.strictEqual(parentOut!.parentId, 'sys_root');
	});

	test('enrichTopology without preserveHierarchy flattens non-route nodes', () => {
		const parent = makeFeatureNode('feat_parent_abcd', 'sys_root', '功能地图');
		const child = makeFeatureNode('feat_child_efgh', 'feat_parent_abcd', '分析引擎');
		child.parentId = 'feat_parent_abcd';

		const enriched = enrichTopology([parent, child], [], 'void');
		const childOut = enriched.find(n => n.id === 'feat_child_efgh');
		assert.strictEqual(childOut!.parentId, 'sys_root');
	});

	test('isStaleFunctionMapGraph detects v0.2.0 and mod_* majority', () => {
		assert.ok(isStaleFunctionMapGraph({
			version: '0.2.0',
			nodes: [makeFeatureNode('mod_contrib_void', 'sys_root', 'contrib')],
		}));
		assert.ok(isStaleFunctionMapGraph({
			version: '0.3.0',
			nodes: [
				makeFeatureNode('mod_a', 'sys_root', 'a'),
				makeFeatureNode('mod_b', 'sys_root', 'b'),
				makeFeatureNode('feat_ok', 'sys_root', 'ok'),
			],
		}));
		assert.ok(!isStaleFunctionMapGraph({
			version: '0.3.0',
			nodes: [
				makeFeatureNode('feat_a', 'sys_root', '功能地图'),
				makeFeatureNode('feat_b', 'feat_a', '分析引擎'),
				makeFeatureNode('mod_legacy', 'sys_root', 'legacy'),
			],
		}));
	});

	test('golden graph shape: feat_ ids and depth >= 2', () => {
		const nodes = [
			makeFeatureNode('feat_map_ab12', 'sys_root', '功能地图'),
			makeFeatureNode('feat_engine_cd34', 'feat_map_ab12', '分析引擎'),
		];
		nodes[1]!.parentId = 'feat_map_ab12';
		const enriched = enrichTopology(nodes, [], 'void', { preserveHierarchy: true });

		const featNodes = enriched.filter(n => n.id.startsWith('feat_'));
		const maxDepth = Math.max(...enriched.map(n => n.depth));
		const hasNested = enriched.some(n => n.parentId && n.parentId !== 'sys_root');

		assert.ok(featNodes.length >= 2);
		assert.ok(maxDepth >= 2);
		assert.ok(hasNested);
		assert.ok(!featNodes.some(n => /^mod_contrib_/.test(n.id)));
	});
});
