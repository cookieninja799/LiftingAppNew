// ai/providers/gemini.ts
// Google Gemini provider implementation

import { AIProvider, ProviderError, ProviderErrorCode, ParseWorkoutTextResult } from './AIProvider';
import { WORKOUT_PARSE_SYSTEM_PROMPT } from '@/ai/workoutParsePrompt';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

export class GeminiProvider implements AIProvider {
  constructor(private model: string) {}

  async parseWorkoutText(text: string, apiKey: string): Promise<ParseWorkoutTextResult> {
    try {
      const response = await fetch(
        `${GEMINI_API_BASE}/models/${this.model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `${WORKOUT_PARSE_SYSTEM_PROMPT}\n\nINPUT:\n${text}`,
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.3,
              responseMimeType: 'application/json',
            },
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw this.mapError(response.status, errorData);
      }

      const data = await response.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

      if (!rawText) {
        throw new ProviderError('provider_error', 'Empty response from Gemini');
      }

      return { rawText };
    } catch (error) {
      if (error instanceof ProviderError) {
        throw error;
      }
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new ProviderError('network_error', 'Network request failed', error);
      }
      throw new ProviderError('provider_error', `Gemini API error: ${error instanceof Error ? error.message : 'Unknown error'}`, error);
    }
  }

  async testKey(apiKey: string): Promise<{ success: boolean; error?: ProviderErrorCode; message?: string }> {
    try {
      const response = await fetch(
        `${GEMINI_API_BASE}/models/${this.model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'test' }] }],
            generationConfig: { maxOutputTokens: 10 },
          }),
        }
      );

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

