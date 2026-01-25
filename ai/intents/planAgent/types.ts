import { z } from 'zod';
import { WorkoutSession } from '@/utils/workoutSessions';

export type PlanToolName =
  | 'get_recent_workouts'
  | 'get_exercise_working_weights'
  | 'calculate_recommended_weight'
  | 'check_muscle_recovery'
  | 'estimate_weight_from_similar'
  | 'get_exercise_alternative'
  | 'find_similar_exercises_by_pattern'
  | 'get_strength_standard'
  | 'get_standards_adjustment';

export interface PlanToolContext {
  sessions: WorkoutSession[];
}

export interface PlanToolDefinition<TArgs extends z.ZodTypeAny, TResult> {
  name: PlanToolName;
  description: string;
  schema: TArgs;
  handler: (args: z.infer<TArgs>, ctx: PlanToolContext) => TResult;
}

export interface PlanAgentResult {
  title: string;
  rationale: string[];
  exercises: Array<{
    exercise: string;
    sets: number;
    reps: string;
    intensity?: string;
    notes?: string;
    recommendedWeight?: {
      value: number;
      unit: string;
      basedOn: 'pr' | 'recent' | 'estimate';
      confidence: 'high' | 'medium' | 'low';
      prWeight?: number;
      percentageOfMax?: number;
    };
  }>;
  progressionStyle?: 'aggressive' | 'gradual' | 'maintenance' | 'deload';
}

export interface PlanAgentFinalResponse {
  type: 'final';
  plan: PlanAgentResult;
}

export interface PlanAgentToolCall {
  type: 'tool_call';
  tool: PlanToolName;
  args?: Record<string, unknown>;
}
