// __tests__/unit/planIntent.test.ts
// Unit tests for Plan intent parsing and execution

import { PlanIntentSchema } from '@/ai/intents/planSchema';
import { executePlanIntent } from '@/ai/intents/planExecutor';
import { WorkoutSession, WorkoutExercise, WorkoutSet } from '@/utils/workoutSessions';

describe('PlanIntentSchema', () => {
  it('should validate basic workout_plan intent', () => {
    const result = PlanIntentSchema.safeParse({
      type: 'workout_plan',
    });
    expect(result.success).toBe(true);
  });

  it('should validate workout_plan with all fields', () => {
    const result = PlanIntentSchema.safeParse({
      type: 'workout_plan',
      goal: 'hypertrophy',
      durationMinutes: 60,
      focus: 'upper',
    });
    expect(result.success).toBe(true);
  });

  it('should validate workout_plan with partial fields', () => {
    const result = PlanIntentSchema.safeParse({
      type: 'workout_plan',
      goal: 'strength',
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid goal', () => {
    const result = PlanIntentSchema.safeParse({
      type: 'workout_plan',
      goal: 'invalid',
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid focus', () => {
    const result = PlanIntentSchema.safeParse({
      type: 'workout_plan',
      focus: 'invalid',
    });
    expect(result.success).toBe(false);
  });
});

describe('executePlanIntent', () => {
  const createMockSession = (
    date: string,
    exercises: Array<{ name: string; sets: Array<{ reps: number; weight: string }> }>
  ): WorkoutSession => {
    const now = new Date().toISOString();
    const workoutExercises: WorkoutExercise[] = exercises.map((ex, exIdx) => {
      const exerciseId = `ex-${date}-${exIdx}`;
      const sets: WorkoutSet[] = ex.sets.map((set, setIdx) => ({
        id: `set-${exerciseId}-${setIdx}`,
        exerciseId,
        setIndex: setIdx,
        reps: set.reps,
        weightText: set.weight,
        isBodyweight: false,
        updatedAt: now,
        createdAt: now,
      }));

      return {
        id: exerciseId,
        sessionId: `session-${date}`,
        nameRaw: ex.name,
        sets,
        updatedAt: now,
        createdAt: now,
      };
    });

    return {
      id: `session-${date}`,
      performedOn: date,
      exercises: workoutExercises,
      updatedAt: now,
      createdAt: now,
    };
  };

  it('should generate generic plan for empty sessions', async () => {
    const result = await executePlanIntent(
      { type: 'workout_plan' },
      []
    );

    expect(result.isGeneric).toBe(true);
    expect(result.exercises.length).toBeGreaterThan(0);
    expect(result.rationale.some(r => r.includes('generic'))).toBe(true);
  });

  it('should generate plan with focus', async () => {
    const result = await executePlanIntent(
      { type: 'workout_plan', focus: 'upper' },
      []
    );

    expect(result.title.toLowerCase()).toContain('upper');
    expect(result.exercises.length).toBeGreaterThan(0);
  });

  it('should avoid recently trained exercises', async () => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const sessions = [
      createMockSession(yesterday.toISOString().split('T')[0], [
        { name: 'Bench Press', sets: [{ reps: 10, weight: '135' }] },
      ]),
    ];

    const result = await executePlanIntent(
      { type: 'workout_plan', focus: 'push' },
      sessions
    );

    // Should avoid Bench Press since it was trained yesterday
    const hasBenchPress = result.exercises.some(ex => 
      ex.exercise.toLowerCase().includes('bench')
    );
    expect(hasBenchPress).toBe(false);
    expect(result.basedOnData?.exercisesAvoided).toContain('Bench Press');
  });

  it('should include rationale about last training day', async () => {
    const now = new Date();
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

    const sessions = [
      createMockSession(threeDaysAgo.toISOString().split('T')[0], [
        { name: 'Squat', sets: [{ reps: 5, weight: '225' }] },
      ]),
    ];

    const result = await executePlanIntent(
      { type: 'workout_plan', focus: 'lower' },
      sessions
    );

    expect(result.basedOnData?.lastLowerDay).toBeDefined();
    expect(result.rationale.some(r => r.includes('last'))).toBe(true);
  });

  it('should respect goal for rep ranges', async () => {
    const result = await executePlanIntent(
      { type: 'workout_plan', goal: 'strength' },
      []
    );

    // Strength should use 3-6 rep range
    expect(result.exercises[0].reps).toBe('3–6');
  });

  it('should respect duration for exercise count', async () => {
    const result30 = await executePlanIntent(
      { type: 'workout_plan', durationMinutes: 30 },
      []
    );
    const result60 = await executePlanIntent(
      { type: 'workout_plan', durationMinutes: 60 },
      []
    );

    // Longer duration should have more exercises (or same if already at max)
    expect(result60.exercises.length).toBeGreaterThanOrEqual(result30.exercises.length);
  });
});

