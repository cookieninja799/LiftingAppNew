// ai/providers/anthropic.ts
// Anthropic provider implementation

import { AIProvider, ProviderError, ProviderErrorCode, ParseWorkoutTextResult } from './AIProvider';
import { WORKOUT_PARSE_SYSTEM_PROMPT } from '@/ai/workoutParsePrompt';

const ANTHROPIC_API_BASE = 'https://api.anthropic.com/v1';

export class AnthropicProvider implements AIProvider {
  constructor(private model: string) {}

  async parseWorkoutText(text: string, apiKey: string): Promise<ParseWorkoutTextResult> {
    try {
      const response = await fetch(`${ANTHROPIC_API_BASE}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 4096,
          system: WORKOUT_PARSE_SYSTEM_PROMPT,
          messages: [
            {
              role: 'user',
              content: text,
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw this.mapError(response.status, errorData);
      }

      const data = await response.json();
      const rawText = data.content?.[0]?.text || '';

      if (!rawText) {
        throw new ProviderError('provider_error', 'Empty response from Anthropic');
      }

      return { rawText };
    } catch (error) {
      if (error instanceof ProviderError) {
        throw error;
      }
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new ProviderError('network_error', 'Network request failed', error);
      }
      throw new ProviderError('provider_error', `Anthropic API error: ${error instanceof Error ? error.message : 'Unknown error'}`, error);
    }
  }

  async testKey(apiKey: string): Promise<{ success: boolean; error?: ProviderErrorCode; message?: string }> {
    try {
      // Use a minimal message request to test the key
      const response = await fetch(`${ANTHROPIC_API_BASE}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 10,
          messages: [{ role: 'user', content: 'test' }],
        }),
      });

      if (!response.ok) {
        const error = this.mapError(response.status, {});
        return { success: false, error: error.code, message: error.message };
      }

      return { success: true };
    } catch (error) {
      if (error instanceof ProviderError) {
        return { success: false, error: error.code, message: error.message };
      }
      return { success: false, error: 'network_error', message: 'Network request failed' };
    }
  }

  private mapError(status: number, errorData: any): ProviderError {
    if (status === 401 || status === 403) {
      return new ProviderError('invalid_api_key', 'Invalid API key');
    }
    if (status === 429) {
      return new ProviderError('rate_limited', 'Rate limit exceeded');
    }
    if (status === 402) {
      return new ProviderError('insufficient_quota', 'Insufficient quota');
    }
    const message = errorData?.error?.message || `HTTP ${status}`;
    return new ProviderError('provider_error', message);
  }
}

