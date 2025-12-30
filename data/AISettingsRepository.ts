// data/AISettingsRepository.ts
// Manages AI provider settings and API key storage

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSecret, setSecret, deleteSecret } from '@/utils/secureStore';

export type AIProvider = 'openai' | 'anthropic' | 'gemini';

export type ExecutionMode = 'byok' | 'hosted';

export type AIMode = 'log' | 'ask' | 'plan';

export interface AISettings {
  provider: AIProvider;
  model: string;
  executionMode: ExecutionMode;
  useTemplateMuscles: boolean;
  allowModelProvidedMuscles: boolean;
  uiMode?: AIMode; // Phase 4: UI mode selector (Log/Ask/Plan)
}

const AI_SETTINGS_KEY = 'ai_settings_v1';

const DEFAULT_SETTINGS: AISettings = {
  provider: 'openai',
  model: 'gpt-4o-mini',
  executionMode: 'byok',
  useTemplateMuscles: true,
  allowModelProvidedMuscles: false,
  uiMode: 'log', // Default to Log mode (Phase 3 behavior)
};

/**
 * Generates a SecureStore alias for an API key
 */
function getKeyAlias(provider: AIProvider, model: string): string {
  return `aiKey_${provider}_${model}`;
}

/**
 * Gets current AI settings
 */
export async function getSettings(): Promise<AISettings> {
  try {
    const stored = await AsyncStorage.getItem(AI_SETTINGS_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
    return DEFAULT_SETTINGS;
  } catch (error) {
    console.error('Failed to load AI settings:', error);
    return DEFAULT_SETTINGS;
  }
}

/**
 * Saves AI settings (without API key)
 */
export async function saveSettings(settings: AISettings): Promise<void> {
  try {
    await AsyncStorage.setItem(AI_SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('Failed to save AI settings:', error);
    throw new Error('Failed to save AI settings');
  }
}

/**
 * Gets the API key for the current provider/model
 */
export async function getApiKey(provider: AIProvider, model: string): Promise<string | null> {
  const alias = getKeyAlias(provider, model);
  return await getSecret(alias);
}

/**
 * Saves the API key for a provider/model
 */
export async function saveApiKey(provider: AIProvider, model: string, apiKey: string): Promise<void> {
  const alias = getKeyAlias(provider, model);
  await setSecret(alias, apiKey);
}

/**
 * Clears the API key for a provider/model
 */
export async function clearApiKey(provider: AIProvider, model: string): Promise<void> {
  const alias = getKeyAlias(provider, model);
  await deleteSecret(alias);
}

/**
 * Clears all API keys (useful for logout)
 */
export async function clearAllKeys(): Promise<void> {
  const settings = await getSettings();
  await clearApiKey(settings.provider, settings.model);
}

