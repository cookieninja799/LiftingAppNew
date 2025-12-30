// __tests__/unit/intentParser.test.ts
// Unit tests for intent parsing safety fallbacks

import { extractJson } from '@/ai/extractJson';
import { AskIntentSchema } from '@/ai/intents/askSchema';
import { PlanIntentSchema } from '@/ai/intents/planSchema';
import { executeAskIntent } from '@/ai/intents/askExecutor';
import { WorkoutSession } from '@/utils/workoutSessions';

describe('Intent Parsing Safety', () => {
  describe('extractJson fallback', () => {
    it('should handle non-JSON text gracefully', () => {
      const result = extractJson('This is just plain text');
      expect(result.success).toBe(false);
      expect(result.error).toBe('no_json_found');
    });

    it('should extract JSON from code fences', () => {
      const result = extractJson('```json\n{"type": "last_exercise_date", "exercise": "Bench"}\n```');
      expect(result.success).toBe(true);
      if (result.success) {
        const parsed = JSON.parse(result.jsonText);
        expect(parsed.type).toBe('last_exercise_date');
      }
    });

    it('should handle invalid JSON', () => {
      const result = extractJson('{"type": "invalid json}');
      expect(result.success).toBe(false);
    });
  });

  describe('AskIntentSchema validation', () => {
    it('should reject malformed JSON', () => {
      const result = AskIntentSchema.safeParse({ type: 'invalid' });
      expect(result.success).toBe(false);
    });

    it('should reject extra fields gracefully', () => {
      const result = AskIntentSchema.safeParse({
        type: 'last_exercise_date',
        exercise: 'Bench Press',
        extraField: 'should be ignored',
      });
      // Zod by default strips extra fields, so this should still succeed
      expect(result.success).toBe(true);
    });

    it('should handle missing required fields', () => {
      const result = AskIntentSchema.safeParse({
        type: 'last_exercise_date',
        // missing exercise
      });
      expect(result.success).toBe(false);
    });

    it('should handle wrong type discriminator', () => {
      const result = AskIntentSchema.safeParse({
        type: 'not_a_real_type',
        exercise: 'Bench Press',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('PlanIntentSchema validation', () => {
    it('should reject invalid type', () => {
      const result = PlanIntentSchema.safeParse({
        type: 'not_workout_plan',
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid enum values', () => {
      const result = PlanIntentSchema.safeParse({
        type: 'workout_plan',
        goal: 'invalid_goal',
      });
      expect(result.success).toBe(false);
    });

    it('should accept valid optional fields', () => {
      const result = PlanIntentSchema.safeParse({
        type: 'workout_plan',
        goal: 'strength',
        focus: 'upper',
        durationMinutes: 45,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('No data found behavior', () => {
    it('should return user-friendly message for empty sessions in Ask', async () => {
      const result = await executeAskIntent(
        { type: 'last_exercise_date', exercise: 'Bench Press' },
        []
      );
      expect(result.answerText).toContain("don't have any workout data");
      expect(result.data.sources).toEqual([]);
    });

    it('should return user-friendly message for non-existent exercise', async () => {
      // Create a session with a different exercise so we're not testing empty sessions
      const mockSession: WorkoutSession = {
        id: 'session-1',
        performedOn: '2024-01-01',
        exercises: [{
          id: 'ex-1',
          sessionId: 'session-1',
          nameRaw: 'Squat',
          sets: [{
            id: 'set-1',
            exerciseId: 'ex-1',
            setIndex: 0,
            reps: 10,
            weightText: '135',
            isBodyweight: false,
            updatedAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
          }],
          updatedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        }],
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };
      
      const result = await executeAskIntent(
        { type: 'last_exercise_date', exercise: 'NonExistent Exercise' },
        [mockSession]
      );
      expect(result.answerText).toContain("couldn't find");
    });
  });
});

