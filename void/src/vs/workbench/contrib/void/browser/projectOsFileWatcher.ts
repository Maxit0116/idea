/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { registerWorkbenchContribution2, WorkbenchPhase, IWorkbenchContribution } from '../../../common/contributions.js';
import { ITextFileService } from '../../../services/textfile/common/textfiles.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { IProjectOsService } from '../common/projectOsTypes.js';

class ProjectOsFileWatcherContribution extends Disposable implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.projectOsFileWatcher';

	constructor(
		@ITextFileService private readonly textFileService: ITextFileService,
		@IWorkspaceContextService private readonly workspaceService: IWorkspaceContextService,
		@IProjectOsService private readonly projectOsService: IProjectOsService,
	) {
		super();

		this._register(this.textFileService.files.onDidSave(e => {
			const folders = this.workspaceService.getWorkspace().folders;
			if (folders.length === 0) {
				return;
			}
			const root = folders[0].uri;
			const saved = e.model.resource;
			if (!saved.fsPath.startsWith(root.fsPath)) {
				return;
			}
			// Skip graph artifact writes
			if (saved.fsPath.includes('.projectos')) {
				return;
			}
			if (this.projectOsService.state.status !== 'ready' && this.projectOsService.state.status !== 'analyzing') {
				return;
			}
			this.projectOsService.scheduleReanalyze(root.fsPath);
		}));
	}
}

registerWorkbenchContribution2(ProjectOsFileWatcherContribution.ID, ProjectOsFileWatcherContribution, WorkbenchPhase.Eventually);
