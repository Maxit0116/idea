import { sendLLMMessage } from '../../../llmMessage/sendLLMMessage.js'
import type { IMetricsService } from '../../../../common/metricsService.js'
import type { GeminiLLMChatMessage, LLMChatMessage } from '../../../../common/sendLLMMessageTypes.js'
import type {
	ChatMode,
	ModelSelection,
	ModelSelectionOptions,
	OverridesOfModel,
	ProviderName,
	SettingsOfProvider,
} from '../../../../common/voidSettingsTypes.js'
import type { ModelOverrides } from '../../../../common/modelCapabilities.js'
import { llmCallTimeoutMs } from './llm-timeouts.js'

export interface SendLlmChatParams {
	messages: LLMChatMessage[]
	separateSystemMessage: string
	modelSelection: ModelSelection
	settingsOfProvider: SettingsOfProvider
	modelSelectionOptions: ModelSelectionOptions | undefined
	overridesOfModel: OverridesOfModel
	chatMode?: ChatMode
	loggingName: string
	metricsService: IMetricsService
}

/** Project OS LLM callers use OpenAI-style { role, content }; convert per provider before send. */
function normalizeMessagesForProvider(
	messages: LLMChatMessage[],
	providerName: ProviderName,
): LLMChatMessage[] {
	return messages.map((m): LLMChatMessage => {
		const openAiStyle = m as LLMChatMessage & { role?: string; content?: string }
		const text = typeof openAiStyle.content === 'string' ? openAiStyle.content : null
		if (!text) {
			return m
		}

		if (providerName === 'gemini') {
			if (openAiStyle.role === 'user') {
				return { role: 'user', parts: [{ text }] } satisfies GeminiLLMChatMessage
			}
			if (openAiStyle.role === 'assistant') {
				return { role: 'model', parts: [{ text }] } satisfies GeminiLLMChatMessage
			}
		}

		if (providerName === 'anthropic') {
			if (openAiStyle.role === 'user') {
				return { role: 'user', content: text } as LLMChatMessage
			}
			if (openAiStyle.role === 'assistant') {
				return { role: 'assistant', content: text } as LLMChatMessage
			}
		}

		if (openAiStyle.role === 'user' || openAiStyle.role === 'system' || openAiStyle.role === 'developer') {
			return { role: openAiStyle.role, content: text }
		}
		if (openAiStyle.role === 'assistant') {
			return { role: 'assistant', content: text }
		}

		return m
	})
}

/** Function Map LLM calls need structured JSON — disable reasoning/thinking for speed and parse reliability. */
function functionMapModelOptions(
	modelSelectionOptions: ModelSelectionOptions | undefined,
): ModelSelectionOptions {
	return {
		...modelSelectionOptions,
		reasoningEnabled: false,
	}
}

/** Ollama qwen3 thinks by default; pass think:false for structured JSON output. */
function functionMapOverrides(
	modelSelection: ModelSelection,
	overridesOfModel: OverridesOfModel,
): OverridesOfModel {
	const { providerName, modelName } = modelSelection
	if (providerName !== 'ollama' || !modelName.toLowerCase().includes('qwen3')) {
		return overridesOfModel
	}
	const extra: Partial<ModelOverrides> = {
		additionalOpenAIPayload: { think: false } as unknown as ModelOverrides['additionalOpenAIPayload'],
	}
	return {
		...overridesOfModel,
		ollama: {
			...overridesOfModel.ollama,
			[modelName]: {
				...overridesOfModel.ollama?.[modelName],
				...extra,
			},
		},
	}
}

export function sendLlmChatPromise(params: SendLlmChatParams): Promise<string> {
	const messages = normalizeMessagesForProvider(params.messages, params.modelSelection.providerName)
	const modelSelectionOptions = functionMapModelOptions(params.modelSelectionOptions)
	const overridesOfModel = functionMapOverrides(params.modelSelection, params.overridesOfModel)
	const callTimeoutMs = llmCallTimeoutMs(params.modelSelection.providerName)

	const llmPromise = new Promise<string>((resolve, reject) => {
		const abortRef = { current: null as (() => void) | null }

		void sendLLMMessage({
			messagesType: 'chatMessages',
			messages,
			separateSystemMessage: params.separateSystemMessage,
			chatMode: params.chatMode ?? 'normal',
			onText: () => { },
			onFinalMessage: ({ fullText }) => {
				if (typeof fullText !== 'string' || !fullText.trim()) {
					reject(new Error('LLM 返回空响应'))
					return
				}
				resolve(fullText)
			},
			onError: ({ message }) => reject(new Error(message)),
			abortRef,
			logging: { loggingName: params.loggingName },
			modelSelection: params.modelSelection,
			modelSelectionOptions,
			overridesOfModel,
			settingsOfProvider: params.settingsOfProvider,
			mcpTools: undefined,
		}, params.metricsService)
	})

	const timeoutPromise = new Promise<never>((_, reject) => {
		setTimeout(
			() => reject(new Error(`LLM 单次调用超时（${Math.round(callTimeoutMs / 60_000)} 分钟）: ${params.loggingName}`)),
			callTimeoutMs,
		)
	})

	return Promise.race([llmPromise, timeoutPromise])
}
