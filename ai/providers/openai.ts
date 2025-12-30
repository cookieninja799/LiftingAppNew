// ai/providers/openai.ts
// OpenAI provider implementation

import { AIProvider, ProviderError, ProviderErrorCode, ParseWorkoutTextResult } from './AIProvider';
import { WORKOUT_PARSE_SYSTEM_PROMPT } from '@/ai/workoutParsePrompt';

const OPENAI_API_BASE = 'https://api.openai.com/v1';

export class OpenAIProvider implements AIProvider {
  constructor(private model: string) {}

  async parseWorkoutText(text: string, apiKey: string): Promise<ParseWorkoutTextResult> {
    try {
      const response = await fetch(`${OPENAI_API_BASE}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'system',
              content: WORKOUT_PARSE_SYSTEM_PROMPT,
            },
            {
              role: 'user',
              content: text,
            },
          ],
          temperature: 0.3,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw this.mapError(response.status, errorData);
      }

      const data = await response.json();
      const rawText = data.choices?.[0]?.message?.content || '';

      if (!rawText) {
        throw new ProviderError('provider_error', 'Empty response from OpenAI');
      }

      return { rawText };
    } catch (error) {
      if (error instanceof ProviderError) {
        throw error;
      }
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new ProviderError('network_error', 'Network request failed', error);
      }
      throw new ProviderError('provider_error', `OpenAI API error: ${error instanceof Error ? error.message : 'Unknown error'}`, error);
    }
  }

  async testKey(apiKey: string): Promise<{ success: boolean; error?: ProviderErrorCode; message?: string }> {
    try {
      const response = await fetch(`${OPENAI_API_BASE}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
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

  async complete(systemPrompt: string, userText: string, apiKey: string): Promise<ParseWorkoutTextResult> {
    try {
      const response = await fetch(`${OPENAI_API_BASE}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'system',
              content: systemPrompt,
            },
            {
              role: 'user',
              content: userText,
            },
          ],
          temperature: 0.3,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw this.mapError(response.status, errorData);
      }

      const data = await response.json();
      const rawText = data.choices?.[0]?.message?.content || '';

      if (!rawText) {
        throw new ProviderError('provider_error', 'Empty response from OpenAI');
      }

      return { rawText };
    } catch (error) {
      if (error instanceof ProviderError) {
        throw error;
      }
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new ProviderError('network_error', 'Network request failed', error);
      }
      throw new ProviderError('provider_error', `OpenAI API error: ${error instanceof Error ? error.message : 'Unknown error'}`, error);
    }
  }

  private mapError(status: number, errorData: any): ProviderError {
    if (status === 401) {
      return new ProviderError('invalid_api_key', 'Invalid API key');
    }
    if (status === 429) {
      return new ProviderError('rate_limited', 'Rate limit exceeded');
    }
    if (status === 402 || status === 403) {
      return new ProviderError('insufficient_quota', 'Insufficient quota or access denied');
    }
    const message = errorData?.error?.message || `HTTP ${status}`;
    return new ProviderError('provider_error', message);
  }
}

