// utils/assistantParsing.ts
// Extracted parsing logic from RecordWorkout.tsx for testability

export type ParsedExercise = {
  id: string;
  date: string;
  exercise: string;
  sets: number;
  reps: number[];
  weights: string[];
  primaryMuscleGroup?: string;
};

export type AssistantMessage = {
  type: string;
  text?: {
    value: string;
  };
};

export type AssistantResponse = {
  messages?: AssistantMessage[][];
};

export type IdFactory = () => string;
export type DateFactory = () => string;

/**
 * Default ID factory - generates unique IDs based on timestamp + random string
 */
export const defaultIdFactory: IdFactory = (): string =>
  Date.now().toString() + Math.random().toString(36).substring(2, 8);

/**
 * Default date factory - returns today's date in YYYY-MM-DD format
 */
export const defaultDateFactory: DateFactory = (): string => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Extracts JSON text blocks from assistant response messages.
 * Filters for text messages that start with '{' or '[' (JSON structures).
 * 
 * @param messagesPayload - The response payload containing messages array
 * @returns Array of JSON text strings
 */
export function extractJsonTextBlocks(messagesPayload: AssistantResponse): string[] {
  if (!messagesPayload?.messages) {
    return [];
  }

  const jsonBlocks: string[] = [];

  const flatMessages = messagesPayload.messages.flat();
  
  flatMessages.forEach((msg: AssistantMessage) => {
    const trimmed = msg?.text?.value?.trim();
    if (msg?.type === 'text' && trimmed && (trimmed.startsWith('{') || trimmed.startsWith('['))) {
      jsonBlocks.push(trimmed);
    }
  });

  return jsonBlocks;
}

/**
 * Parses JSON text blocks into normalized ParsedExercise array.
 * Handles:
 * - JSON array root: [{...}, {...}]
 * - JSON object root with exercises array: { exercises: [...] }
 * - Single exercise object: {...}
 * 
 * Applies defaults for missing fields:
 * - date → nowDate (from dateFactory)
 * - sets → 1
 * - reps → []
 * - weights → []
 * 
 * @param jsonTextBlocks - Array of JSON text strings to parse
 * @param options - Configuration options
 * @param options.dateFactory - Factory function to get current date (default: today's date)
 * @param options.idFactory - Factory function to generate unique IDs
 * @returns Array of parsed exercises
 */
export function parseAssistantExercises(
  jsonTextBlocks: string[],
  options: {
    dateFactory?: DateFactory;
    idFactory?: IdFactory;
  } = {}
): ParsedExercise[] {
  const { 
    dateFactory = defaultDateFactory, 
    idFactory = defaultIdFactory 
  } = options;

  const parsedExercises: ParsedExercise[] = [];

  jsonTextBlocks.forEach((jsonText) => {
    try {
      const parsed = JSON.parse(jsonText);
      const nowDate = dateFactory();

      if (Array.isArray(parsed)) {
        // JSON array root: [{...}, {...}]
        parsed.forEach((exercise: any) => {
          parsedExercises.push(normalizeExercise(exercise, nowDate, idFactory));
        });
      } else if (parsed.exercises && Array.isArray(parsed.exercises)) {
        // JSON object root with exercises array: { exercises: [...] }
        parsed.exercises.forEach((exercise: any) => {
          parsedExercises.push(normalizeExercise(exercise, nowDate, idFactory));
        });
      } else {
        // Single exercise object
        parsedExercises.push(normalizeExercise(parsed, nowDate, idFactory));
      }
    } catch (error) {
      // Ignore non-JSON text blocks - this is expected for prose responses
      console.error('Error parsing JSON response:', error);
    }
  });

  return parsedExercises;
}

/**
 * Normalizes a raw exercise object to a ParsedExercise with defaults applied
 */
function normalizeExercise(
  exercise: any,
  defaultDate: string,
  idFactory: IdFactory
): ParsedExercise {
  return {
    id: idFactory(),
    date: exercise.date || defaultDate,
    exercise: exercise.exercise || 'Unknown Exercise',
    sets: exercise.sets || 1,
    reps: Array.isArray(exercise.reps) ? exercise.reps : [],
    weights: Array.isArray(exercise.weights) ? exercise.weights : [],
    primaryMuscleGroup: exercise.primaryMuscleGroup,
  };
}

/**
 * Convenience function that combines extractJsonTextBlocks and parseAssistantExercises
 */
export function parseAssistantResponse(
  response: AssistantResponse,
  options: {
    dateFactory?: DateFactory;
    idFactory?: IdFactory;
  } = {}
): ParsedExercise[] {
  const jsonBlocks = extractJsonTextBlocks(response);
  return parseAssistantExercises(jsonBlocks, options);
}
