// __tests__/unit/aiProviders.test.ts
// Unit tests for AI providers (mocked)

import { OpenAIProvider } from '@/ai/providers/openai';
import { AnthropicProvider } from '@/ai/providers/anthropic';
import { GeminiProvider } from '@/ai/providers/gemini';
import { ProviderError } from '@/ai/providers/AIProvider';

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch as jest.MockedFunction<typeof fetch>;

describe('AI Providers', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  describe('OpenAIProvider', () => {
    const provider = new OpenAIProvider('gpt-4o-mini');

    it('should parse workout text successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: '[{"id":"2024-12-03-1","date":"2024-12-03","exercise":"Bench Press","sets":3,"reps":[10,10,10],"weights":["135","135","135"],"primaryMuscleGroup":null,"muscleContributions":null}]',
              },
            },
          ],
        }),
      } as Response);

      const result = await provider.parseWorkoutText('Bench Press 3x10 @ 135', 'test-key');
      expect(result.rawText.trim().startsWith('[')).toBe(true);
    });

    it('should handle invalid API key', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: { message: 'Invalid API key' } }),
      } as Response);

      await expect(provider.parseWorkoutText('test', 'invalid-key')).rejects.toThrow(ProviderError);
    });

    it('should handle rate limiting', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({}),
      } as Response);

      await expect(provider.parseWorkoutText('test', 'test-key')).rejects.toThrow(ProviderError);
    });

    it('should test key successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      } as Response);

      const result = await provider.testKey('test-key');
      expect(result.success).toBe(true);
    });

    it('should test key failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({}),
      } as Response);

      const result = await provider.testKey('invalid-key');
      expect(result.success).toBe(false);
      expect(result.error).toBe('invalid_api_key');
    });
  });

  describe('AnthropicProvider', () => {
    const provider = new AnthropicProvider('claude-3-5-sonnet-20241022');

    it('should parse workout text successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [
            {
              text: '[{"id":"2024-12-03-1","date":"2024-12-03","exercise":"Squat","sets":5,"reps":[5,5,5,5,5],"weights":["225","225","225","225","225"],"primaryMuscleGroup":null,"muscleContributions":null}]',
            },
          ],
        }),
      } as Response);

      const result = await provider.parseWorkoutText('Squat 5x5 @ 225', 'test-key');
      expect(result.rawText.trim().startsWith('[')).toBe(true);
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('Network request failed'));

      await expect(provider.parseWorkoutText('test', 'test-key')).rejects.toThrow(ProviderError);
    });
  });

  describe('GeminiProvider', () => {
    const provider = new GeminiProvider('gemini-1.5-pro');

    it('should parse workout text successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: '[{"id":"null-1","date":null,"exercise":"Deadlift","sets":1,"reps":[5],"weights":["315"],"primaryMuscleGroup":null,"muscleContributions":null}]',
                  },
                ],
              },
            },
          ],
        }),
      } as Response);

      const result = await provider.parseWorkoutText('Deadlift 1x5 @ 315', 'test-key');
      expect(result.rawText.trim().startsWith('[')).toBe(true);
    });

    it('should handle empty response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [] } }],
        }),
      } as Response);

      await expect(provider.parseWorkoutText('test', 'test-key')).rejects.toThrow(ProviderError);
    });
  });
});

