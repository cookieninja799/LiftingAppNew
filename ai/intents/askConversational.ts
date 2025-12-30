// ai/intents/askConversational.ts
// Handles conversational responses using LLM for general_chat and muscle_group_exercises intents

import { getSettings, getApiKey } from '@/data/AISettingsRepository';
import { createProvider } from '../providers';
import { CONVERSATIONAL_RESPONSE_PROMPT } from './prompts';
import { AskResult } from './askExecutor';

interface LLMContext {
  type: string;
  originalQuery: string;
  [key: string]: any;
}

/**
 * Checks if an AskResult needs an LLM-generated response
 */
export function needsLLMResponse(result: AskResult): boolean {
  return result.data._needsLLMResponse === true;
}

/**
 * Generates a conversational LLM response for general_chat and muscle_group_exercises intents
 */
export async function generateConversationalResponse(
  result: AskResult,
  options: {
    supabaseClient?: any;
  } = {}
): Promise<AskResult> {
  const { supabaseClient } = options;
  const context = result.data._llmContext as LLMContext;
  
  if (!context) {
    // Fallback if no context - shouldn't happen
    return {
      ...result,
      answerText: "I'm here to help with your workouts! Ask me anything about exercises, your training history, or fitness in general.",
    };
  }

  // Build the user prompt with context
  const userPrompt = buildUserPrompt(context);

  try {
    const settings = await getSettings();
    let rawText: string;

    if (settings.executionMode === 'hosted') {
      if (!supabaseClient) {
        throw new Error('Supabase client required for hosted mode');
      }
      const { data, error } = await supabaseClient.functions.invoke('parse-workout-text', {
        body: {
          provider: settings.provider,
          model: settings.model,
          task: 'conversational_response',
          systemPrompt: CONVERSATIONAL_RESPONSE_PROMPT,
          text: userPrompt,
        },
      });

      if (error) {
        throw new Error(`Hosted mode error: ${error.message}`);
      }

      rawText = data?.rawText || '';
    } else {
      // BYOK mode
      const apiKey = await getApiKey(settings.provider, settings.model);
      if (!apiKey) {
        throw new Error(`API key not found for ${settings.provider}/${settings.model}`);
      }

      const provider = createProvider(settings.provider, settings.model);
      const response = await provider.complete(CONVERSATIONAL_RESPONSE_PROMPT, userPrompt, apiKey);
      rawText = response.rawText;
    }

    // Clean up the response (remove any accidental JSON or markdown)
    const cleanedResponse = cleanResponse(rawText);

    return {
      ...result,
      answerText: cleanedResponse,
      data: {
        ...result.data,
        _needsLLMResponse: undefined, // Remove the flag
        _llmContext: undefined, // Remove the context
      },
    };
  } catch (error) {
    console.error('Error generating conversational response:', error);
    // Fallback to a helpful response
    return {
      ...result,
      answerText: getFallbackResponse(context),
      data: {
        ...result.data,
        _needsLLMResponse: undefined,
        _llmContext: undefined,
      },
    };
  }
}

/**
 * Builds the user prompt with context for the LLM
 */
function buildUserPrompt(context: LLMContext): string {
  let prompt = `User's question: "${context.originalQuery}"\n\n`;

  if (context.type === 'muscle_group_exercises') {
    prompt += `The user is asking about exercises for: ${context.muscleGroup}\n\n`;
    if (context.suggestedExercises?.length > 0) {
      prompt += `Good exercises for ${context.muscleGroup}: ${context.suggestedExercises.join(', ')}\n`;
    }
    if (context.exercisesUserHasDone?.length > 0) {
      prompt += `From their workout history, they've done: ${context.exercisesUserHasDone.join(', ')}\n`;
    }
  } else if (context.type === 'general_chat') {
    prompt += `Topic: ${context.topic}\n\n`;
    if (context.userContext) {
      const uc = context.userContext;
      prompt += `User context:\n`;
      if (uc.totalWorkouts > 0) {
        prompt += `- They have logged ${uc.totalWorkouts} workout${uc.totalWorkouts > 1 ? 's' : ''}\n`;
      }
      if (uc.daysSinceLastWorkout !== null) {
        if (uc.daysSinceLastWorkout === 0) {
          prompt += `- They worked out today\n`;
        } else if (uc.daysSinceLastWorkout === 1) {
          prompt += `- They worked out yesterday\n`;
        } else {
          prompt += `- Their last workout was ${uc.daysSinceLastWorkout} days ago\n`;
        }
      }
      if (uc.recentExercises?.length > 0) {
        prompt += `- Recent exercises: ${uc.recentExercises.join(', ')}\n`;
      }
    }
  }

  prompt += `\nRespond naturally to their question.`;
  return prompt;
}

/**
 * Cleans up LLM response by removing any JSON or markdown artifacts
 */
function cleanResponse(text: string): string {
  let cleaned = text.trim();
  
  // Remove markdown code blocks if present
  cleaned = cleaned.replace(/```[\s\S]*?```/g, '');
  
  // Remove JSON if the whole response is JSON
  if (cleaned.startsWith('{') && cleaned.endsWith('}')) {
    try {
      const parsed = JSON.parse(cleaned);
      if (parsed.response || parsed.answer || parsed.text) {
        cleaned = parsed.response || parsed.answer || parsed.text;
      }
    } catch {
      // Not valid JSON, keep as is
    }
  }
  
  return cleaned.trim();
}

/**
 * Returns a fallback response if LLM fails
 */
function getFallbackResponse(context: LLMContext): string {
  if (context.type === 'muscle_group_exercises' && context.suggestedExercises?.length > 0) {
    return `Great exercises for ${context.muscleGroup}: ${context.suggestedExercises.slice(0, 5).join(', ')}. Try incorporating a few of these into your next workout!`;
  }
  
  if (context.type === 'general_chat') {
    const topic = context.topic?.toLowerCase() || '';
    if (topic.includes('greeting') || context.originalQuery?.match(/^(hi|hello|hey)/i)) {
      return "Hey! 💪 Ready to crush a workout? Ask me anything about your training!";
    }
    if (topic.includes('how are you')) {
      return "I'm doing great, thanks for asking! What can I help you with today?";
    }
  }
  
  return "I'm here to help with your workouts! Feel free to ask me about exercises, your training history, or what you should work on next.";
}

