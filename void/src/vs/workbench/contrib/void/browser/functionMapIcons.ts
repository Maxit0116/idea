/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Codicon } from '../../../../base/common/codicons.js';
import { localize } from '../../../../nls.js';
import { registerIcon } from '../../../../platform/theme/common/iconRegistry.js';

/** Activity bar icon — constellation / architecture graph (center hub + connected nodes). */
export const functionMapViewIcon = registerIcon(
	'projectos-function-map',
	Codicon.graph,
	localize('functionMapViewIcon', 'Function Map — project architecture topology'),
);
