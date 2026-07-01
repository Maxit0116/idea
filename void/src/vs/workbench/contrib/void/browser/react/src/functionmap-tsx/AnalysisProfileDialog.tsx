/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useState } from 'react';
import type { AnalysisProfile } from '../../../../common/projectOsTypes.js';

export interface AnalysisProfileDialogProps {
	open: boolean;
	hasLlm: boolean;
	defaultProfile: AnalysisProfile;
	onConfirm: (profile: AnalysisProfile, remember: boolean) => void;
	onCancel: () => void;
}

const PROFILES: { id: AnalysisProfile; label: string; desc: string; needsLlm: boolean }[] = [
	{ id: 'quick', label: '快速', desc: '技术模块图（目录聚类）+ 可选 AI 命名，约 5–15 秒', needsLlm: false },
	{ id: 'standard', label: '标准', desc: 'AI 产品功能树（README/屏幕入口驱动）+ 自动细化子功能', needsLlm: true },
	{ id: 'deep', label: '深度', desc: 'AI 功能树全量分解，更多 feature 细化与 unit 节点', needsLlm: true },
];

export function AnalysisProfileDialog({
	open,
	hasLlm,
	defaultProfile,
	onConfirm,
	onCancel,
}: AnalysisProfileDialogProps) {
	const [selected, setSelected] = useState<AnalysisProfile>(defaultProfile);
	const [remember, setRemember] = useState(false);

	if (!open) {
		return null;
	}

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
			<div className="bg-void-bg-2 border border-void-border rounded-xl shadow-xl max-w-md w-full p-5 space-y-4">
				<div>
					<div className="text-void-fg-1 font-semibold text-sm">选择分析模式</div>
					<div className="text-void-fg-3 text-xs mt-1">分析前请选择适合项目的功能地图生成方式</div>
				</div>
				<div className="space-y-2">
					{PROFILES.map(p => {
						const disabled = p.needsLlm && !hasLlm;
						return (
							<label
								key={p.id}
								className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
									selected === p.id ? 'border-blue-500/60 bg-blue-500/10' : 'border-void-border hover:bg-void-bg-3'
								} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
							>
								<input
									type="radio"
									name="analysis-profile"
									checked={selected === p.id}
									disabled={disabled}
									onChange={() => setSelected(p.id)}
									className="mt-0.5"
								/>
								<div>
									<div className="text-void-fg-1 text-xs font-medium">{p.label}</div>
									<div className="text-void-fg-3 text-[11px] mt-0.5">{p.desc}</div>
									{disabled && (
										<div className="text-amber-400 text-[10px] mt-1">需要配置 API Key</div>
									)}
								</div>
							</label>
						);
					})}
				</div>
				<label className="flex items-center gap-2 text-xs text-void-fg-2 cursor-pointer">
					<input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} />
					记住本次选择（写入 Settings）
				</label>
				<div className="flex justify-end gap-2 pt-1">
					<button type="button" onClick={onCancel} className="px-3 py-1.5 text-xs text-void-fg-2 hover:bg-void-bg-3 rounded-lg">
						取消
					</button>
					<button
						type="button"
						onClick={() => onConfirm(selected, remember)}
						className="px-4 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
					>
						开始分析
					</button>
				</div>
			</div>
		</div>
	);
}
