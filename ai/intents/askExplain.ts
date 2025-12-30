// ai/intents/askExplain.ts
// Optional LLM explanation for Ask results

import { parseIntent, IntentTask } from './intentParser';
import { ASK_EXPLAIN_SYSTEM_PROMPT } from './prompts';
import { AskResult } from './askExecutor';

export interface AskExplainResult {
  explanation: string;
  originalResult: AskResult;
}

/**
 * Uses LLM to generate a friendly explanation of Ask result
 * This is optional - the deterministic formatter can be used instead
 */
export async function explainAskResult(
  result: AskResult,
  options: {
    supabaseClient?: any;
  } = {}
): Promise<AskExplainResult> {
  // Format the data as context for LLM
  const context = JSON.stringify(result.data, null, 2);
  const userPrompt = `Explain this workout data in a friendly way:\n\n${context}`;

  const explainSchema = {
    safeParse: (data: unknown) => {
      if (typeof data === 'string') {
        return { success: true, data: data };
      }
      if (data && typeof data === 'object' && 'explanation' in data) {
        return { success: true, data: (data as any).explanation };
      }
      return { success: false, error: { message: 'Invalid explanation format' } };
    },
  };

  const parseResult = await parseIntent<string>(
    userPrompt,
    'ask_explain',
    ASK_EXPLAIN_SYSTEM_PROMPT,
    explainSchema,
    options
  );

  if (parseResult.success && parseResult.intent) {
    return {
      explanation: parseResult.intent,
      originalResult: result,
    };
  }

  // Fallback to original answer text if LLM fails
  return {
    explanation: result.answerText,
    originalResult: result,
  };
}

