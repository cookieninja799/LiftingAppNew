import { z } from 'zod';

export const planAgentResponseSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('tool_call'),
    tool: z.enum([
      'get_recent_workouts',
      'get_exercise_working_weights',
      'calculate_recommended_weight',
      'check_muscle_recovery',
      'estimate_weight_from_similar',
      'get_exercise_alternative',
      'find_similar_exercises_by_pattern',
      'get_strength_standard',
      'get_standards_adjustment',
    ]),
    args: z.record(z.unknown()).optional(),
  }),
  z.object({
    type: z.literal('final'),
    plan: z.object({
      title: z.string(),
      rationale: z.array(z.string()),
      exercises: z.array(
        z.object({
          exercise: z.string(),
          sets: z.number(),
          reps: z.string(),
          intensity: z.string().optional(),
          notes: z.string().optional(),
          recommendedWeight: z
            .object({
              value: z.number(),
              unit: z.string(),
              basedOn: z.enum(['pr', 'recent', 'estimate']),
              confidence: z.enum(['high', 'medium', 'low']),
              prWeight: z.number().optional(),
              percentageOfMax: z.number().optional(),
            })
            .optional(),
        })
      ),
      progressionStyle: z.enum(['aggressive', 'gradual', 'maintenance', 'deload']).optional(),
    }),
  }),
]);
