import { getCloudConfig, isAuthenticated } from './auth'

export interface LlmRequest {
  model: string
  messages: { role: string; content: string }[]
  maxTokens?: number
  temperature?: number
}

export interface LlmResponse {
  content: string
  usage: { inputTokens: number; outputTokens: number }
}

// M3 stub: will proxy LLM calls through cloud service
export async function callLlm(_request: LlmRequest): Promise<LlmResponse> {
  if (!isAuthenticated()) {
    throw new Error('Not authenticated. Configure cloud settings first.')
  }
  const config = getCloudConfig()
  throw new Error(`LLM proxy not implemented. API URL: ${config.apiUrl}`)
}

export async function streamLlm(
  _request: LlmRequest,
  _onChunk: (chunk: string) => void
): Promise<LlmResponse> {
  throw new Error('Streaming LLM proxy not implemented until M3')
}
