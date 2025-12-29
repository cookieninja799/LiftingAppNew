// ai/providers/index.ts
// Provider factory

import { AIProvider as AIProviderInterface } from './AIProvider';
import { OpenAIProvider } from './openai';
import { AnthropicProvider } from './anthropic';
import { GeminiProvider } from './gemini';
import { AIProvider as ProviderType } from '@/data/AISettingsRepository';

export function createProvider(provider: ProviderType, model: string): AIProviderInterface {
  switch (provider) {
    case 'openai':
      return new OpenAIProvider(model);
    case 'anthropic':
      return new AnthropicProvider(model);
    case 'gemini':
      return new GeminiProvider(model);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

