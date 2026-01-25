import { getApiKey, getSettings } from '@/data/AISettingsRepository';
import { extractJson } from '@/ai/extractJson';
import { createProvider } from '@/ai/providers';
import { ProviderError } from '@/ai/providers/AIProvider';

export interface NormalizeExerciseResult {
  success: boolean;
  canonical: string;
  rawText?: string;
  error?: string;
}

const SYSTEM_PROMPT = `You are a workout exercise name normalizer.

Your job is to take a raw exercise name and return a canonical exercise name as JSON.

Rules:
- Output MUST be valid JSON only (no markdown, no extra text).
- Use lowercase words.
- Normalize punctuation and spacing.
- If unsure, preserve the user's wording (cleaned).

Output schema:
{ "canonical": "string" }`;

export async function normalizeExerciseNameWithAI(
  nameRaw: string,
  options: {
    context?: string[];
    supabaseClient?: any;
  } = {}
): Promise<NormalizeExerciseResult> {
  const { context = [], supabaseClient } = options;
  const settings = await getSettings();
  const userPrompt = [
    `Exercise: ${nameRaw}`,
    context.length > 0 ? `Similar exercises: ${context.join(', ')}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  try {
    let rawText = '';
    if (settings.executionMode === 'hosted') {
      if (!supabaseClient) {
        throw new ProviderError('auth_error', 'Supabase client required for hosted mode');
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
          task: 'conversational_response',
          systemPrompt: SYSTEM_PROMPT,
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
      const apiKey = await getApiKey(settings.provider, settings.model);
      if (!apiKey) {
        throw new Error(`API key not found for ${settings.provider}/${settings.model}`);
      }
      const provider = createProvider(settings.provider, settings.model);
      const result = await provider.complete(SYSTEM_PROMPT, userPrompt, apiKey);
      rawText = result.rawText;
    }

    const extractResult = extractJson(rawText);
    if (!extractResult.success) {
      return {
        success: false,
        canonical: nameRaw,
        rawText,
        error: `Failed to extract JSON: ${extractResult.error}`,
      };
    }

    let parsed: any;
    try {
      parsed = JSON.parse(extractResult.jsonText);
    } catch (error) {
      return {
        success: false,
        canonical: nameRaw,
        rawText,
        error: 'Extracted JSON is invalid',
      };
    }

    const canonical =
      typeof parsed?.canonical === 'string' && parsed.canonical.trim().length > 0
        ? parsed.canonical.trim()
        : nameRaw;

    return {
      success: true,
      canonical,
      rawText,
    };
  } catch (error) {
    return {
      success: false,
      canonical: nameRaw,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
