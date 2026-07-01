/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { useCallback, useState } from 'react';
import type { AnalysisOptions, AnalysisProfile } from '../../../../common/projectOsTypes.js';
import { useAccessor, useSettingsState } from '../util/services.js';
import { isProviderReadyForModelOptions } from '../../../../common/voidSettingsTypes.js';

export function useAnalyzeWithDialog() {
	const accessor = useAccessor();
	const projectOsService = accessor.get('IProjectOsService');
	const voidSettingsService = accessor.get('IVoidSettingsService');
	const settingsState = useSettingsState();
	const [dialogOpen, setDialogOpen] = useState(false);
	const [pendingPath, setPendingPath] = useState<string | null>(null);

	const hasLlm = (() => {
		const useChat = settingsState.globalSettings.functionMapUseChatModel;
		const model = useChat
			? settingsState.modelSelectionOfFeature.Chat
			: (settingsState.modelSelectionOfFeature.FunctionMap ?? settingsState.modelSelectionOfFeature.Chat);
		return !!(model && isProviderReadyForModelOptions(model.providerName, settingsState));
	})();

	const openAnalyzeDialog = useCallback((projectPath: string) => {
		setPendingPath(projectPath);
		setDialogOpen(true);
	}, []);

	const runAnalyze = useCallback(async (projectPath: string, profile: AnalysisProfile, remember: boolean) => {
		if (remember) {
			voidSettingsService.setGlobalSetting('functionMapAnalysisProfile', profile);
		}
		const options: AnalysisOptions = {
			profile,
			tokenBudget: settingsState.globalSettings.functionMapTokenBudget,
			lazyRefinement: settingsState.globalSettings.functionMapLazyRefinement,
			maxUnitNodesPerFeature: settingsState.globalSettings.functionMapMaxUnitNodesPerFeature,
		};
		await projectOsService.analyze(projectPath, options);
	}, [projectOsService, voidSettingsService, settingsState]);

	const confirmDialog = useCallback(async (profile: AnalysisProfile, remember: boolean) => {
		setDialogOpen(false);
		if (pendingPath) {
			await runAnalyze(pendingPath, profile, remember);
		}
		setPendingPath(null);
	}, [pendingPath, runAnalyze]);

	const cancelDialog = useCallback(() => {
		setDialogOpen(false);
		setPendingPath(null);
	}, []);

	return {
		dialogOpen,
		hasLlm,
		defaultProfile: hasLlm ? 'standard' : settingsState.globalSettings.functionMapAnalysisProfile,
		openAnalyzeDialog,
		confirmDialog,
		cancelDialog,
	};
}
