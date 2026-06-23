/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { localize, localize2 } from '../../../../nls.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { EditorExtensions } from '../../../common/editor.js';
import { EditorPaneDescriptor, IEditorPaneRegistry } from '../../../browser/editor.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { registerWorkbenchContribution2, WorkbenchPhase, IWorkbenchContribution } from '../../../common/contributions.js';
import { Categories } from '../../../../platform/action/common/actionCommonCategories.js';
import { MenuId } from '../../../../platform/actions/common/actions.js';
import { IViewsService } from '../../../services/views/common/viewsService.js';
import { FunctionMapEditor } from './functionMapEditor.js';
import { FunctionMapInput } from './functionMapInput.js';
import { IProjectOsService } from '../common/projectOsTypes.js';
import {
	FUNCTION_MAP_OPEN_ACTION_ID,
	FUNCTION_MAP_OPEN_SIDEBAR_ACTION_ID,
	FUNCTION_MAP_VIEW_CONTAINER_ID,
} from './functionMapPane.js';
import { functionMapViewIcon } from './functionMapIcons.js';
import './functionMapPane.js';

export const PROJECT_OS_OPEN_FUNCTION_MAP_ACTION_ID = FUNCTION_MAP_OPEN_ACTION_ID;

async function openFunctionMapMainEditor(accessor: ServicesAccessor): Promise<void> {
	const editorService = accessor.get(IEditorService);
	const instantiationService = accessor.get(IInstantiationService);
	const input = instantiationService.createInstance(FunctionMapInput);
	await editorService.openEditor(input, { pinned: true });
}

Registry.as<IEditorPaneRegistry>(EditorExtensions.EditorPane).registerEditorPane(
	EditorPaneDescriptor.create(
		FunctionMapEditor,
		FunctionMapEditor.ID,
		localize('functionMapEditorPane', 'Function Map'),
	),
	[new SyncDescriptor(FunctionMapInput)],
);

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: PROJECT_OS_OPEN_FUNCTION_MAP_ACTION_ID,
			title: localize2('openFunctionMap', 'Open Function Map'),
			category: Categories.View,
			icon: functionMapViewIcon,
			f1: true,
			menu: [{
				id: MenuId.MenubarViewMenu,
				group: '3_projectos',
				order: 1,
			}],
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		await openFunctionMapMainEditor(accessor);
		await accessor.get(IViewsService).openViewContainer(FUNCTION_MAP_VIEW_CONTAINER_ID);
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: FUNCTION_MAP_OPEN_SIDEBAR_ACTION_ID,
			title: localize2('openFunctionMapSidebar', 'Open Architecture Info Sidebar'),
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		await accessor.get(IViewsService).openViewContainer(FUNCTION_MAP_VIEW_CONTAINER_ID);
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'projectos.analyzeWorkspace',
			title: localize2('analyzeWorkspace', 'Analyze Project Structure'),
			category: Categories.View,
			f1: true,
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const workspaceService = accessor.get(IWorkspaceContextService);
		const projectOsService = accessor.get(IProjectOsService);
		const viewsService = accessor.get(IViewsService);

		const folders = workspaceService.getWorkspace().folders;
		if (folders.length === 0) {
			return;
		}

		await openFunctionMapMainEditor(accessor);
		await viewsService.openViewContainer(FUNCTION_MAP_VIEW_CONTAINER_ID);
		await projectOsService.analyze(folders[0].uri.fsPath);
	}
});

class ProjectOsWorkspaceContribution implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.projectOsWorkspace';

	constructor(
		@IWorkspaceContextService private readonly workspaceService: IWorkspaceContextService,
		@IProjectOsService private readonly projectOsService: IProjectOsService,
	) {
		const folders = this.workspaceService.getWorkspace().folders;
		if (folders.length > 0) {
			void this.projectOsService.tryLoadFromWorkspace(folders[0].uri.fsPath);
		}
	}
}

registerWorkbenchContribution2(ProjectOsWorkspaceContribution.ID, ProjectOsWorkspaceContribution, WorkbenchPhase.Eventually);

/** When user clicks the Function Map activity bar icon, open the map in the main editor area. */
class FunctionMapActivityBarContribution extends Disposable implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.functionMapActivityBar';

	constructor(
		@IViewsService private readonly viewsService: IViewsService,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@IEditorService private readonly editorService: IEditorService,
	) {
		super();
		this._register(this.viewsService.onDidChangeViewContainerVisibility(e => {
			if (e.id === FUNCTION_MAP_VIEW_CONTAINER_ID && e.visible) {
				void this.openMainEditor();
			}
		}));
	}

	private async openMainEditor(): Promise<void> {
		const input = this.instantiationService.createInstance(FunctionMapInput);
		await this.editorService.openEditor(input, { pinned: true });
	}
}

registerWorkbenchContribution2(FunctionMapActivityBarContribution.ID, FunctionMapActivityBarContribution, WorkbenchPhase.AfterRestored);
