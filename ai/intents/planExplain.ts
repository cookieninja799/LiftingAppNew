// ai/intents/planExplain.ts
// Optional LLM explanation for Plan results

import { parseIntent, IntentTask } from './intentParser';
import { PLAN_EXPLAIN_SYSTEM_PROMPT } from './prompts';
import { WorkoutPlan } from './planExecutor';

export interface PlanExplainResult {
  explanation: string;
  originalPlan: WorkoutPlan;
}

/**
 * Uses LLM to generate a friendly explanation of Plan result
 * This is optional - the plan can be displayed directly
 */
export async function explainPlanResult(
  plan: WorkoutPlan,
  options: {
    supabaseClient?: any;
  } = {}
): Promise<PlanExplainResult> {
  // Format the plan as context for LLM
  const context = JSON.stringify(plan, null, 2);
  const userPrompt = `Explain this workout plan in a friendly, motivational way:\n\n${context}`;

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
    'plan_explain',
    PLAN_EXPLAIN_SYSTEM_PROMPT,
    explainSchema,
    options
  );

  if (parseResult.success && parseResult.intent) {
    return {
      explanation: parseResult.intent,
      originalPlan: plan,
    };
  }

  // Fallback to rationale if LLM fails
  return {
    explanation: plan.rationale.join(' '),
    originalPlan: plan,
  };
}

