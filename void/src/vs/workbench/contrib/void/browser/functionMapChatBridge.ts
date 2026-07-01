/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { URI } from '../../../../base/common/uri.js';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { ILanguageService } from '../../../../editor/common/languages/language.js';
import { StagingSelectionItem } from '../common/chatThreadServiceTypes.js';
import { nodeThreadRegistryStorageKey } from '../common/storageKeys.js';
import {
	FunctionMapThreadBinding,
	IProjectOsService,
	PROJECT_NODE_KEY,
	ProjectOsChatContext,
} from '../common/projectOsTypes.js';
import { IChatThreadService } from './chatThreadService.js';

export const IFunctionMapChatBridge = createDecorator<IFunctionMapChatBridge>('functionMapChatBridge');

export interface IFunctionMapChatBridge {
	readonly _serviceBrand: undefined;
}

/**
 * Orchestrates Function Map selection → per-node Chat thread + file staging.
 * Kept separate from ProjectOsService to avoid circular dependency with ChatThreadService.
 */
class FunctionMapChatBridge extends Disposable implements IFunctionMapChatBridge {
	readonly _serviceBrand: undefined;

	constructor(
		@IProjectOsService private readonly projectOsService: IProjectOsService,
		@IChatThreadService private readonly chatThreadService: IChatThreadService,
		@IStorageService private readonly storageService: IStorageService,
		@ILanguageService private readonly languageService: ILanguageService,
	) {
		super();
		this._register(this.projectOsService.onDidChangeChatContext(ctx => {
			void this.onChatContextChanged(ctx);
		}));
	}

	private readRegistry(projectId: string): Record<string, string> {
		const raw = this.storageService.get(nodeThreadRegistryStorageKey(projectId), StorageScope.WORKSPACE);
		if (!raw) {
			return {};
		}
		try {
			return JSON.parse(raw) as Record<string, string>;
		} catch {
			return {};
		}
	}

	private writeRegistry(projectId: string, registry: Record<string, string>): void {
		this.storageService.store(
			nodeThreadRegistryStorageKey(projectId),
			JSON.stringify(registry),
			StorageScope.WORKSPACE,
			StorageTarget.USER,
		);
	}

	private resolveNodeKey(ctx: ProjectOsChatContext): string {
		return ctx.level === 'project' ? PROJECT_NODE_KEY : (ctx.nodeId ?? PROJECT_NODE_KEY);
	}

	private async onChatContextChanged(ctx: ProjectOsChatContext | null): Promise<void> {
		if (!ctx) {
			return;
		}
		const state = this.projectOsService.state;
		if (state.status !== 'ready') {
			return;
		}
		const { graph } = state;
		const nodeKey = this.resolveNodeKey(ctx);
		const binding: FunctionMapThreadBinding = {
			projectId: graph.projectId,
			nodeKey,
			level: ctx.level,
			label: ctx.label,
			nodeId: ctx.nodeId,
		};

		let threadId = this.chatThreadService.findThreadByNodeKey(graph.projectId, nodeKey);
		if (!threadId) {
			const registry = this.readRegistry(graph.projectId);
			const fromRegistry = registry[nodeKey];
			if (fromRegistry && this.chatThreadService.state.allThreads[fromRegistry]) {
				threadId = fromRegistry;
				this.chatThreadService.setThreadState(fromRegistry, { functionMapBinding: { ...binding } });
				this.chatThreadService.switchToThread(fromRegistry);
			}
		}

		let isNew = false;
		if (threadId) {
			this.chatThreadService.setThreadState(threadId, { functionMapBinding: { ...binding } });
			this.chatThreadService.switchToThread(threadId);
		} else {
			const result = this.chatThreadService.getOrCreateBoundThread(binding);
			threadId = result.threadId;
			isNew = result.isNew;
		}

		const registry = this.readRegistry(graph.projectId);
		registry[nodeKey] = threadId;
		this.writeRegistry(graph.projectId, registry);

		if (ctx.primaryFilePaths.length > 0) {
			void this.stageFiles(graph.projectPath, threadId, ctx.primaryFilePaths, isNew);
		}
	}

	private async stageFiles(
		projectPath: string,
		threadId: string,
		filePaths: string[],
		isNew: boolean,
	): Promise<void> {
		const threadState = this.chatThreadService.getThreadState(threadId);
		if (!threadState) {
			return;
		}

		const existing = threadState.stagingSelections ?? [];
		const existingPaths = new Set(
			existing
				.filter((s): s is StagingSelectionItem & { type: 'File' } => s.type === 'File')
				.map(s => s.uri.fsPath),
		);

		const newSelections: StagingSelectionItem[] = [];
		for (const relPath of filePaths) {
			const absPath = `${projectPath}/${relPath.replace(/^\//, '')}`;
			if (!isNew && existingPaths.has(absPath)) {
				continue;
			}
			const uri = URI.file(absPath);
			const language = this.languageService.createByFilepathOrFirstLine(uri, undefined).languageId || 'plaintext';
			newSelections.push({
				type: 'File',
				uri,
				language,
				state: { wasAddedAsCurrentFile: false },
			});
		}

		if (newSelections.length === 0 && !isNew) {
			return;
		}

		let merged: StagingSelectionItem[];
		if (isNew) {
			merged = newSelections;
		} else {
			merged = [...existing];
			for (const sel of newSelections) {
				if (sel.type === 'File' && !existingPaths.has(sel.uri.fsPath)) {
					merged.push(sel);
				}
			}
		}

		this.chatThreadService.setThreadState(threadId, { stagingSelections: merged });
	}
}

registerSingleton(IFunctionMapChatBridge, FunctionMapChatBridge, InstantiationType.Eager);
