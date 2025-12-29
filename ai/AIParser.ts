// ai/AIParser.ts
// Main orchestrator for AI parsing

import { getSettings, getApiKey, AISettings } from '@/data/AISettingsRepository';
import { createProvider } from './providers';
import { extractJson } from './extractJson';
import { validateAndNormalize, ValidationResult } from './validateAndNormalize';
import { ParsedExercise } from '@/utils/assistantParsing';
import { ProviderError } from './providers/AIProvider';

export interface ParseResult {
  exercises: ParsedExercise[];
  warnings: string[];
  confidence: 'high' | 'low';
  rawText?: string;
  rawModelResponseText?: string;
  aiTraceId?: string;
  inputTextHash?: string;
  extractedJsonText?: string;
  normalizedJson?: unknown;
}

/**
 * Generates a UUID v4
 */
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Computes SHA-256 hash of text (for privacy-preserving trace)
 */
async function sha256(text: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Fallback for environments without crypto.subtle
  // Simple hash function (not cryptographically secure, but sufficient for trace IDs)
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16);
}

/**
 * Calls hosted mode via Supabase Edge Function
 */
async function callHostedMode(
  text: string,
  settings: AISettings,
  supabaseClient: any
): Promise<{ rawText: string }> {
  try {
    const { data, error } = await supabaseClient.functions.invoke('parse-workout-text', {
      body: {
        provider: settings.provider,
        model: settings.model,
        text,
      },
    });

    if (error) {
      throw new ProviderError('provider_error', `Hosted mode error: ${error.message}`);
    }

    if (!data || !data.rawText) {
      throw new ProviderError('provider_error', 'Empty response from hosted mode');
    }

    return { rawText: data.rawText };
  } catch (error) {
    if (error instanceof ProviderError) {
      throw error;
    }
    throw new ProviderError('network_error', `Hosted mode failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Main parser function
 */
export async function parseWorkoutText(
  text: string,
  options: {
    supabaseClient?: any;
    storeRawText?: boolean;
  } = {}
): Promise<ParseResult> {
  const { supabaseClient, storeRawText = false } = options;

  // Generate trace ID and hash
  const aiTraceId = generateUUID();
  const inputTextHash = await sha256(text);

  try {
    // Load settings
    const settings = await getSettings();

    // Get raw model response
    let rawModelResponseText: string;
    let rawText: string;

    if (settings.executionMode === 'hosted') {
      if (!supabaseClient) {
        throw new Error('Supabase client required for hosted mode');
      }
      const result = await callHostedMode(text, settings, supabaseClient);
      rawModelResponseText = result.rawText;
      rawText = result.rawText;
    } else {
      // BYOK mode
      const apiKey = await getApiKey(settings.provider, settings.model);
      if (!apiKey) {
        throw new Error(`API key not found for ${settings.provider}/${settings.model}`);
      }

      const provider = createProvider(settings.provider, settings.model);
      const result = await provider.parseWorkoutText(text, apiKey);
      rawModelResponseText = result.rawText;
      rawText = result.rawText;
    }

    // Extract JSON
    const extractResult = extractJson(rawText);
    if (!extractResult.success) {
      return {
        exercises: [],
        warnings: [`Failed to extract JSON: ${extractResult.error}`],
        confidence: 'low',
        rawText: storeRawText ? text : undefined,
        rawModelResponseText: storeRawText ? rawModelResponseText : undefined,
        aiTraceId,
        inputTextHash,
      };
    }

    const extractedJsonText = extractResult.jsonText;

    // Parse and validate
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(extractedJsonText);
    } catch (error) {
      return {
        exercises: [],
        warnings: ['Extracted JSON is invalid'],
        confidence: 'low',
        rawText: storeRawText ? text : undefined,
        rawModelResponseText: storeRawText ? rawModelResponseText : undefined,
        extractedJsonText,
        aiTraceId,
        inputTextHash,
      };
    }

    // Validate and normalize
    const validationResult = validateAndNormalize(parsedJson, {
      useTemplateMuscles: settings.useTemplateMuscles,
      allowModelProvidedMuscles: settings.allowModelProvidedMuscles,
    });

    if (!validationResult.success) {
      return {
        exercises: [],
        warnings: validationResult.warnings,
        confidence: validationResult.confidence,
        rawText: storeRawText ? text : undefined,
        rawModelResponseText: storeRawText ? rawModelResponseText : undefined,
        extractedJsonText,
        aiTraceId,
        inputTextHash,
      };
    }

    return {
      exercises: validationResult.exercises || [],
      warnings: validationResult.warnings,
      confidence: validationResult.confidence,
      rawText: storeRawText ? text : undefined,
      rawModelResponseText: storeRawText ? rawModelResponseText : undefined,
      extractedJsonText,
      normalizedJson: validationResult.normalizedJson,
      aiTraceId,
      inputTextHash,
    };
  } catch (error) {
    return {
      exercises: [],
      warnings: [
        `Parse error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      ],
      confidence: 'low',
      rawText: storeRawText ? text : undefined,
      aiTraceId,
      inputTextHash,
    };
  }
}

