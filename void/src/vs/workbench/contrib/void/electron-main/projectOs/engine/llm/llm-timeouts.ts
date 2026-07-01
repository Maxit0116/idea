/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { localProviderNames } from '../../../../common/voidSettingsTypes.js';
import type { ProviderName } from '../../../../common/voidSettingsTypes.js';

export function isLocalLlmProvider(providerName: ProviderName | undefined): boolean {
	return !!providerName && (localProviderNames as readonly string[]).includes(providerName);
}

/** Per LLM HTTP call — not the whole multi-pass pipeline. */
export function llmCallTimeoutMs(providerName: ProviderName | undefined): number {
	return isLocalLlmProvider(providerName) ? 1_200_000 : 180_000; // 20 min local / 3 min cloud
}

export function pass2FeatureLimit(profile: 'standard' | 'deep' | 'quick', isLocal: boolean): number {
	if (profile === 'quick') {
		return 0;
	}
	if (isLocal && profile === 'standard') {
		return 0; // Pass2 on expand — keeps initial analyze within one Pass1 budget
	}
	if (isLocal && profile === 'deep') {
		return 2;
	}
	if (profile === 'standard') {
		return 3;
	}
	return 5;
}
