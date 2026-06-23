/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { URI } from '../../../../base/common/uri.js';
import { localize2 } from '../../../../nls.js';
import { EditorInputCapabilities } from '../../../common/editor.js';
import { EditorInput } from '../../../common/editor/editorInput.js';

export const FUNCTION_MAP_EDITOR_INPUT_ID = 'workbench.input.functionMap';

export class FunctionMapInput extends EditorInput {

	static readonly ID = FUNCTION_MAP_EDITOR_INPUT_ID;

	override get typeId(): string {
		return FunctionMapInput.ID;
	}

	override getName(): string {
		return localize2('functionMapEditorName', '功能地图').value;
	}

	override get capabilities(): EditorInputCapabilities {
		return EditorInputCapabilities.Singleton | super.capabilities;
	}

	override matches(otherInput: EditorInput): boolean {
		return otherInput instanceof FunctionMapInput;
	}

	override get resource(): URI {
		return URI.from({ scheme: 'projectos', path: 'function-map' });
	}
}
