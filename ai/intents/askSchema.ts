// ai/intents/askSchema.ts
// Zod schema for Ask mode intents

import { z } from 'zod';

export const AskIntentSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('last_exercise_date'),
    exercise: z.string(),
  }),
  z.object({
    type: z.literal('last_exercise_details'),
    exercise: z.string(),
  }),
  z.object({
    type: z.literal('best_exercise'),
    exercise: z.string(),
    metric: z.enum(['weight', 'e1rm', 'volume']),
  }),
  z.object({
    type: z.literal('volume_summary'),
    muscleGroup: z.string().optional(),
    exercise: z.string().optional(),
    range: z.enum(['week', 'month', 'custom']),
    start: z.string().optional(),
    end: z.string().optional(),
  }),
  z.object({
    type: z.literal('last_session_summary'),
  }),
  // New: Workout recommendation based on history
  z.object({
    type: z.literal('workout_recommendation'),
    focus: z.enum(['upper', 'lower', 'push', 'pull', 'legs', 'arms', 'back', 'chest', 'shoulders', 'any']).optional(),
  }),
  // New: Exercise alternative/substitution
  z.object({
    type: z.literal('exercise_alternative'),
    exercise: z.string(),
    reason: z.string().optional(), // e.g., "no equipment", "injury", "variety"
  }),
  // New: Open-ended/conversational (fallback for questions that don't fit other intents)
  z.object({
    type: z.literal('general_chat'),
    topic: z.string(), // Brief summary of what user is asking about
    originalQuery: z.string(), // The user's original question
  }),
  // New: Exercises for a muscle group
  z.object({
    type: z.literal('muscle_group_exercises'),
    muscleGroup: z.string(), // The muscle group to find exercises for
  }),
  // New: Progress/trend tracking for an exercise
  z.object({
    type: z.literal('exercise_progress'),
    exercise: z.string(), // The exercise to check progress for
    timeframe: z.enum(['recent', 'month', 'all_time']).optional(), // How far back to look
  }),
]);

export type AskIntent = z.infer<typeof AskIntentSchema>;

