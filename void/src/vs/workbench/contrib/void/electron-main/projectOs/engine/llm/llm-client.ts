export interface LlmClientConfig {
  provider: 'openai' | 'anthropic' | 'cloud'
  apiKey?: string
  model?: string
  baseUrl?: string
}

// M1/M2 stub: local LLM client for summarization and understanding
export class LlmClient {
  private config: LlmClientConfig | null = null

  configure(config: LlmClientConfig): void {
    this.config = config
  }

  isConfigured(): boolean {
    return this.config !== null
  }

  async summarize(_content: string): Promise<string> {
    if (!this.config) throw new Error('LLM client not configured')
    throw new Error('LLM summarization not implemented until M1')
  }

  async understand(_prompt: string, _context: string): Promise<string> {
    if (!this.config) throw new Error('LLM client not configured')
    throw new Error('LLM understanding not implemented until M2')
  }

  async generatePlan(_prompt: string, _context: string): Promise<string> {
    if (!this.config) throw new Error('LLM client not configured')
    throw new Error('LLM plan generation not implemented until M2')
  }
}

export const llmClient = new LlmClient()
