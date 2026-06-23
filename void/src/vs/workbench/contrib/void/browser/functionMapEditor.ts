/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Dimension } from '../../../../base/browser/dom.js';
import { toDisposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { EditorPane } from '../../../browser/parts/editor/editorPane.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IEditorGroup } from '../../../services/editor/common/editorGroupsService.js';
import { mountFunctionMapEditor } from './react/out/functionmap-tsx/index.js';

type MountResult = ReturnType<typeof mountFunctionMapEditor>;

export class FunctionMapEditor extends EditorPane {

	static readonly ID = 'workbench.editor.functionMap';

	private _mountElt: HTMLElement | undefined;
	private _mountResult: MountResult | undefined;

	constructor(
		group: IEditorGroup,
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IStorageService storageService: IStorageService,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
	) {
		super(FunctionMapEditor.ID, group, telemetryService, themeService, storageService);
	}

	protected createEditor(parent: HTMLElement): void {
		parent.style.height = '100%';
		parent.style.width = '100%';
		parent.style.overflow = 'hidden';

		const mountElt = document.createElement('div');
		mountElt.style.height = '100%';
		mountElt.style.width = '100%';
		mountElt.style.overflow = 'hidden';
		parent.appendChild(mountElt);
		this._mountElt = mountElt;

		this.instantiationService.invokeFunction(accessor => {
			this._mountResult = mountFunctionMapEditor(mountElt, accessor);
			if (this._mountResult?.dispose) {
				this._register(toDisposable(() => this._mountResult?.dispose()));
			}
		});
	}

	override layout(dimension: Dimension): void {
		if (this._mountElt) {
			this._mountElt.style.height = `${dimension.height}px`;
			this._mountElt.style.width = `${dimension.width}px`;
		}
		this._mountResult?.rerender?.({
			containerWidth: dimension.width,
			containerHeight: dimension.height,
		});
	}

	override getTitle(): string {
		return localize('functionMapEditorTitle', '功能地图');
	}
}
