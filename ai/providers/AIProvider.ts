// ai/providers/AIProvider.ts
// Provider-agnostic interface for AI parsing

export type ProviderErrorCode =
  | 'invalid_api_key'
  | 'rate_limited'
  | 'insufficient_quota'
  | 'network_error'
  | 'provider_error';

export class ProviderError extends Error {
  constructor(
    public code: ProviderErrorCode,
    message: string,
    public originalError?: unknown
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

export interface ParseWorkoutTextResult {
  rawText: string;
}

export interface AIProvider {
  /**
   * Parses workout text using the AI provider
   */
  parseWorkoutText(text: string, apiKey: string): Promise<ParseWorkoutTextResult>;

  /**
   * Tests if an API key is valid
   */
  testKey(apiKey: string): Promise<{ success: boolean; error?: ProviderErrorCode; message?: string }>;

  /**
   * Completes a prompt with a custom system prompt (Phase 4: for Ask/Plan intents)
   */
  complete(systemPrompt: string, userText: string, apiKey: string): Promise<ParseWorkoutTextResult>;
}

