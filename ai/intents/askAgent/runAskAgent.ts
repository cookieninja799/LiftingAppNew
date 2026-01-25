import { z } from 'zod';
import { extractJson } from '@/ai/extractJson';
import { getSettings, getApiKey } from '@/data/AISettingsRepository';
import { createProvider } from '@/ai/providers';
import { WorkoutSession } from '@/utils/workoutSessions';
import { AskAgentFinalResponse, AskAgentResult } from './types';
import { getAskTool, AskToolName } from './tools';
import { ASK_AGENT_SYSTEM_PROMPT } from './prompt';

const TOOL_CALL_LIMIT = 4;
const TOOL_RESULT_MAX_CHARS = 6000;
const TOOL_FAILURE_LIMIT = 2;

const askAgentResponseSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('tool_call'),
    tool: z.enum([
      'resolve_exercise_name',
      'get_exercise_sessions',
      'get_exercise_progress',
      'get_last_session_summary',
      'get_prs',
      'get_pr',
      'get_volume_summary',
    ]),
    args: z.record(z.unknown()).optional(),
  }),
  z.object({
    type: z.literal('final'),
    markdown: z.string(),
    suggestions: z.array(z.string()).optional(),
    dataCard: z.object({
      title: z.string(),
      items: z.array(z.object({
        label: z.string(),
        value: z.string(),
      })),
    }).optional(),
  }),
]);

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
    if (Array.isArray(obj.sessions)) {
      return {
        ...obj,
        sessions: obj.sessions.slice(0, 5),
        truncated: true,
      };
    }
    if (Array.isArray(obj.prs)) {
      return {
        ...obj,
        prs: obj.prs.slice(0, 5),
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
        systemPrompt: ASK_AGENT_SYSTEM_PROMPT,
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
  const response = await provider.complete(ASK_AGENT_SYSTEM_PROMPT, userPrompt, apiKey);
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
  const parsedResult = askAgentResponseSchema.safeParse(parsed);
  if (!parsedResult.success) {
    return { success: false, error: parsedResult.error.message };
  }
  return { success: true, data: parsedResult.data };
}

export async function runAskAgent(
  query: string,
  sessions: WorkoutSession[],
  options: { supabaseClient?: any } = {}
): Promise<AskAgentResult | null> {
  const steps: string[] = [];
  steps.push(`User question: "${query}"`);

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
      const finalData = parsed.data as AskAgentFinalResponse;
      return {
        answerMarkdown: finalData.markdown,
        dataCard: finalData.dataCard ?? null,
        suggestions: finalData.suggestions,
      };
    }

    const toolCall = parsed.data;
    const tool = getAskTool(toolCall.tool as AskToolName);
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
