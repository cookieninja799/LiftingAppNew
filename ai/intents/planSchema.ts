// ai/intents/planSchema.ts
// Zod schema for Plan mode intents

import { z } from 'zod';

export const PlanIntentSchema = z.object({
  type: z.literal('workout_plan'),
  goal: z.enum(['strength', 'hypertrophy', 'conditioning']).optional(),
  durationMinutes: z.number().optional(),
  focus: z.enum(['upper', 'lower', 'push', 'pull', 'legs', 'full']).optional(),
  // New: Include personalized weight recommendations based on user's strength levels
  includeWeights: z.boolean().optional(),
  // New: Specific exercises the user wants to include
  requestedExercises: z.array(z.string()).optional(),
});

export type PlanIntent = z.infer<typeof PlanIntentSchema>;

