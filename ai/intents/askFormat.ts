// ai/intents/askFormat.ts
// Deterministic formatting for Ask results (no LLM)

import { AskResult } from './askExecutor';

/**
 * Formats Ask result into a user-friendly data card
 * This is deterministic formatting - no LLM needed
 */
export function formatAskResult(result: AskResult): {
  answerText: string;
  dataCard: {
    title: string;
    items: Array<{ label: string; value: string }>;
  } | null;
  suggestions?: string[];
} {
  const { answerText, data } = result;

  // If we have suggestions but no real data, return just the answer with suggestions
  if (data.suggestions && data.suggestions.length > 0 && !data.matchedExercise && !data.date && data.setsCount === undefined) {
    return {
      answerText,
      dataCard: null,
      suggestions: data.suggestions,
    };
  }

  // Build data card if we have structured data
  const hasData = data.date || data.matchedExercise || data.setsCount !== undefined || 
                  data.bestWeight !== undefined || data.sets || data.sessionExercises;
  
  if (!hasData) {
    return {
      answerText,
      dataCard: null,
    };
  }

  const items: Array<{ label: string; value: string }> = [];

  if (data.date) {
    const date = new Date(data.date);
    items.push({ label: 'Date', value: date.toLocaleDateString() });
  }

  // Use matchedExercise (actual name from history) if available, otherwise fall back to query
  const exerciseName = data.matchedExercise || data.exercise;
  if (exerciseName) {
    items.push({ label: 'Exercise', value: exerciseName });
  }

  if (data.topSet) {
    items.push({ label: 'Top Set', value: `${data.topSet.reps} reps @ ${data.topSet.weight}` });
  }

  if (data.bestWeight !== undefined) {
    items.push({ label: 'Best Weight', value: `${data.bestWeight} lbs` });
    if (data.bestReps !== undefined) {
      items.push({ label: 'Reps', value: `${data.bestReps}` });
    }
  }

  if (data.bestE1RM !== undefined) {
    items.push({ label: 'Estimated 1RM', value: `${data.bestE1RM.toFixed(1)} lbs` });
  }

  if (data.bestVolume !== undefined) {
    items.push({ label: 'Best Volume', value: `${data.bestVolume.toFixed(0)} lbs` });
  }

  if (data.setsCount !== undefined) {
    items.push({ label: 'Total Sets', value: `${data.setsCount}` });
  }

  if (data.sets && data.sets.length > 0) {
    items.push({
      label: 'Sets',
      value: data.sets.map(s => `${s.reps}×${s.weight}`).join(', '),
    });
  }

  if (items.length === 0) {
    return {
      answerText,
      dataCard: null,
    };
  }

  return {
    answerText,
    dataCard: {
      title: exerciseName || 'Workout Data',
      items,
    },
  };
}

