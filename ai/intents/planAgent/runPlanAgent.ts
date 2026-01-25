import { extractJson } from '@/ai/extractJson';
import { createProvider } from '@/ai/providers';
import { getApiKey, getSettings } from '@/data/AISettingsRepository';
import { WorkoutSession } from '@/utils/workoutSessions';
import { PLAN_AGENT_SYSTEM_PROMPT } from './prompt';
import { planAgentResponseSchema } from './schema';
import { getPlanTool } from './tools';
import { PlanAgentFinalResponse } from './types';

const TOOL_CALL_LIMIT = 6;
const TOOL_RESULT_MAX_CHARS = 6000;
const TOOL_FAILURE_LIMIT = 2;

function buildTranscript(parts: string[]): string {
  return parts.join('\n\n');
}

function truncateToolResult(result: unknown): unknown {
  const serialized = JSON.stringify(result);
  if (serialized.length <= TOOL_RESULT_MAX_CHARS) {
    return result;
  }

  if (Array.isArray(result)) {
    return result.slice(0, 5);
  }

  if (result && typeof result === 'object') {
    const obj = result as Record<string, unknown>;
    if (Array.isArray(obj.history)) {
      return {
        ...obj,
        history: obj.history.slice(0, 5),
        truncated: true,
      };
    }
    if (Array.isArray(obj.workouts)) {
      return {
        ...obj,
        workouts: obj.workouts.slice(0, 5),
        truncated: true,
      };
    }
  }

  return { truncated: true };
}

async function completeWithSettings(
  userPrompt: string,
  options: { supabaseClient?: any } = {}
): Promise<string> {
  const settings = await getSettings();
  if (settings.executionMode === 'hosted') {
    if (!options.supabaseClient) {
      throw new Error('Supabase client required for hosted mode');
    }
    const { data, error } = await options.supabaseClient.functions.invoke('parse-workout-text', {
      body: {
        provider: settings.provider,
        model: settings.model,
        task: 'conversational_response',
        systemPrompt: PLAN_AGENT_SYSTEM_PROMPT,
        text: userPrompt,
      },
    });
    if (error) {
      throw new Error(`Hosted mode error: ${error.message}`);
    }
    return data?.rawText || '';
  }

  const apiKey = await getApiKey(settings.provider, settings.model);
  if (!apiKey) {
    throw new Error(`API key not found for ${settings.provider}/${settings.model}`);
  }

  const provider = createProvider(settings.provider, settings.model);
  const response = await provider.complete(PLAN_AGENT_SYSTEM_PROMPT, userPrompt, apiKey);
  return response.rawText;
}

function parseAgentResponse(rawText: string) {
  const extracted = extractJson(rawText);
  if (!extracted.success) {
    return { success: false, error: extracted.error };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(extracted.jsonText);
  } catch (error) {
    return { success: false, error: 'invalid_json' };
  }
  const parsedResult = planAgentResponseSchema.safeParse(parsed);
  if (!parsedResult.success) {
    return { success: false, error: parsedResult.error.message };
  }
  return { success: true, data: parsedResult.data };
}

export async function runPlanAgent(
  query: string,
  sessions: WorkoutSession[],
  options: { supabaseClient?: any } = {}
) {
  const steps: string[] = [];
  steps.push(`User request: "${query}"`);

  let failures = 0;
  for (let step = 0; step < TOOL_CALL_LIMIT; step += 1) {
    const userPrompt = buildTranscript(steps);
    let rawText: string;
    try {
      rawText = await completeWithSettings(userPrompt, options);
    } catch (error) {
      failures += 1;
      if (failures >= TOOL_FAILURE_LIMIT) {
        break;
      }
      continue;
    }

    const parsed = parseAgentResponse(rawText);
    if (!parsed.success) {
      failures += 1;
      steps.push(`Model error: ${parsed.error}`);
      if (failures >= TOOL_FAILURE_LIMIT) {
        break;
      }
      continue;
    }

    if (parsed.data.type === 'final') {
      const finalData = parsed.data as PlanAgentFinalResponse;
      return finalData.plan;
    }

    const toolCall = parsed.data;
    const tool = getPlanTool(toolCall.tool);
    if (!tool) {
      failures += 1;
      steps.push(`Tool error: unknown tool "${toolCall.tool}"`);
      if (failures >= TOOL_FAILURE_LIMIT) {
        break;
      }
      continue;
    }

    const validated = tool.schema.safeParse(toolCall.args ?? {});
    if (!validated.success) {
      failures += 1;
      steps.push(`Tool error: invalid args for ${tool.name}`);
      if (failures >= TOOL_FAILURE_LIMIT) {
        break;
      }
      continue;
    }

    const toolResult = tool.handler(validated.data, { sessions });
    const trimmedResult = truncateToolResult(toolResult);
    steps.push(`Tool call: ${JSON.stringify(toolCall)}`);
    steps.push(`Tool result: ${JSON.stringify(trimmedResult)}`);
  }

  return null;
}
