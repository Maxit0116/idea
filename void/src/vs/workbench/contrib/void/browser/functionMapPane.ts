/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Registry } from '../../../../platform/registry/common/platform.js';
import {
	Extensions as ViewContainerExtensions,
	IViewContainersRegistry,
	ViewContainerLocation,
	IViewsRegistry,
	Extensions as ViewExtensions,
	IViewDescriptorService,
} from '../../../common/views.js';
import * as nls from '../../../../nls.js';
import { ViewPaneContainer } from '../../../browser/parts/views/viewPaneContainer.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { IViewPaneOptions, ViewPane } from '../../../browser/parts/views/viewPane.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { toDisposable } from '../../../../base/common/lifecycle.js';
import { Orientation } from '../../../../base/browser/ui/sash/sash.js';
import { mountFunctionMapSidebar } from './react/out/functionmap-tsx/index.js';
import { functionMapViewIcon } from './functionMapIcons.js';

export const FUNCTION_MAP_VIEW_CONTAINER_ID = 'workbench.view.projectos.functionMap';
export const FUNCTION_MAP_VIEW_ID = 'workbench.view.projectos.functionMap.sidebar';
export const FUNCTION_MAP_OPEN_ACTION_ID = 'projectos.openFunctionMapView';
export const FUNCTION_MAP_OPEN_SIDEBAR_ACTION_ID = 'projectos.openFunctionMapSidebar';

type MountResult = ReturnType<typeof mountFunctionMapSidebar>;

class FunctionMapSidebarViewPane extends ViewPane {

	private _mountElt: HTMLElement | undefined;
	private _mountResult: MountResult | undefined;
	private _lastSize: { width: number; height: number } | undefined;

	constructor(
		options: IViewPaneOptions,
		@IInstantiationService instantiationService: IInstantiationService,
		@IViewDescriptorService viewDescriptorService: IViewDescriptorService,
		@IConfigurationService configurationService: IConfigurationService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IThemeService themeService: IThemeService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IKeybindingService keybindingService: IKeybindingService,
		@IOpenerService openerService: IOpenerService,
		@ITelemetryService telemetryService: ITelemetryService,
		@IHoverService hoverService: IHoverService,
	) {
		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);

		this._register(this.onDidChangeBodyVisibility(visible => {
			if (visible && this._lastSize) {
				this.applyLayout(this._lastSize.width, this._lastSize.height);
			}
		}));
	}

	protected override renderBody(parent: HTMLElement): void {
		super.renderBody(parent);
		parent.style.overflow = 'hidden';
		parent.style.position = 'relative';
		parent.style.height = '100%';
		parent.style.width = '100%';

		const mountElt = document.createElement('div');
		mountElt.style.width = '100%';
		mountElt.style.height = '100%';
		mountElt.style.overflow = 'hidden';
		parent.appendChild(mountElt);
		this._mountElt = mountElt;

		this.instantiationService.invokeFunction(accessor => {
			this._mountResult = mountFunctionMapSidebar(mountElt, accessor);
			if (this._mountResult?.dispose) {
				this._register(toDisposable(() => this._mountResult?.dispose()));
			}
			if (this._lastSize) {
				this.applyLayout(this._lastSize.width, this._lastSize.height);
			}
		});
	}

	protected override layoutBody(height: number, width: number): void {
		super.layoutBody(height, width);
		this._lastSize = { width, height };
		this.applyLayout(width, height);
	}

	private applyLayout(width: number, height: number): void {
		if (this._mountElt) {
			this._mountElt.style.width = `${width}px`;
			this._mountElt.style.height = `${height}px`;
		}
		this._mountResult?.rerender?.({
			containerWidth: width,
			containerHeight: height,
		});
	}
}

const viewContainerRegistry = Registry.as<IViewContainersRegistry>(ViewContainerExtensions.ViewContainersRegistry);
const container = viewContainerRegistry.registerViewContainer({
	id: FUNCTION_MAP_VIEW_CONTAINER_ID,
	title: nls.localize2('functionMapContainer', 'Function Map'),
	ctorDescriptor: new SyncDescriptor(ViewPaneContainer, [FUNCTION_MAP_VIEW_CONTAINER_ID, {
		mergeViewWithContainerWhenSingleView: true,
		orientation: Orientation.HORIZONTAL,
	}]),
	hideIfEmpty: false,
	order: 0,
	rejectAddedViews: true,
	icon: functionMapViewIcon,
}, ViewContainerLocation.Sidebar);

const viewsRegistry = Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry);
viewsRegistry.registerViews([{
	id: FUNCTION_MAP_VIEW_ID,
	hideByDefault: false,
	name: nls.localize2('functionMapSidebarView', 'Architecture Info'),
	ctorDescriptor: new SyncDescriptor(FunctionMapSidebarViewPane),
	canToggleVisibility: true,
	canMoveView: false,
	weight: 100,
	order: 1,
}], container);
