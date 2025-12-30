// ai/intents/intentParser.ts
// Shared intent parser that uses LLM to extract structured intents

import { getSettings, getApiKey, AISettings } from '@/data/AISettingsRepository';
import { createProvider } from '../providers';
import { extractJson } from '../extractJson';
import { ProviderError } from '../providers/AIProvider';

export type IntentTask = 'ask_intent' | 'plan_intent' | 'ask_explain' | 'plan_explain' | 'conversational_response';

export interface IntentParseResult<T> {
  success: boolean;
  intent?: T;
  error?: string;
  rawText?: string;
}

/**
 * Parses user prompt into structured intent using LLM
 */
export async function parseIntent<T>(
  userPrompt: string,
  task: IntentTask,
  systemPrompt: string,
  schema: { safeParse: (data: unknown) => { success: boolean; data?: T; error?: any } },
  options: {
    supabaseClient?: any;
  } = {}
): Promise<IntentParseResult<T>> {
  const { supabaseClient } = options;

  try {
    const settings = await getSettings();
    let rawText: string;

    if (settings.executionMode === 'hosted') {
      if (!supabaseClient) {
        throw new Error('Supabase client required for hosted mode');
      }
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();
      const accessToken = session?.access_token?.trim();
      if (!accessToken) {
        throw new ProviderError('auth_error', 'No active Supabase session (hosted mode requires login)');
      }

      const invokeOptions: any = {
        body: {
          provider: settings.provider,
          model: settings.model,
          task,
          systemPrompt,
          text: userPrompt,
        },
      };
      invokeOptions.headers = { Authorization: `Bearer ${accessToken}` };

      const { data, error } = await supabaseClient.functions.invoke('parse-workout-text', invokeOptions);

      if (error) {
        throw new ProviderError('provider_error', `Hosted mode error: ${error.message}`);
      }

      if (!data || !data.rawText) {
        throw new ProviderError('provider_error', 'Empty response from hosted mode');
      }

      rawText = data.rawText;
    } else {
      // BYOK mode
      const apiKey = await getApiKey(settings.provider, settings.model);
      if (!apiKey) {
        throw new Error(`API key not found for ${settings.provider}/${settings.model}`);
      }

      const provider = createProvider(settings.provider, settings.model);
      const result = await provider.complete(systemPrompt, userPrompt, apiKey);
      rawText = result.rawText;
    }

    // Extract JSON
    const extractResult = extractJson(rawText);
    if (!extractResult.success) {
      return {
        success: false,
        error: `Failed to extract JSON: ${extractResult.error}`,
        rawText,
      };
    }

    // Parse and validate with schema
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(extractResult.jsonText);
    } catch (error) {
      return {
        success: false,
        error: 'Extracted JSON is invalid',
        rawText,
      };
    }

    const validationResult = schema.safeParse(parsedJson);
    if (!validationResult.success) {
      return {
        success: false,
        error: `Schema validation failed: ${validationResult.error?.message || 'Unknown error'}`,
        rawText,
      };
    }

    return {
      success: true,
      intent: validationResult.data as T,
      rawText,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

