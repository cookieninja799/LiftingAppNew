// __tests__/unit/askIntent.test.ts
// Unit tests for Ask intent parsing and execution

import { AskIntentSchema } from '@/ai/intents/askSchema';
import { executeAskIntent } from '@/ai/intents/askExecutor';
import { WorkoutSession, WorkoutExercise, WorkoutSet } from '@/utils/workoutSessions';

describe('AskIntentSchema', () => {
  it('should validate last_exercise_date intent', () => {
    const result = AskIntentSchema.safeParse({
      type: 'last_exercise_date',
      exercise: 'Bench Press',
    });
    expect(result.success).toBe(true);
  });

  it('should validate last_exercise_details intent', () => {
    const result = AskIntentSchema.safeParse({
      type: 'last_exercise_details',
      exercise: 'Deadlift',
    });
    expect(result.success).toBe(true);
  });

  it('should validate best_exercise intent with weight metric', () => {
    const result = AskIntentSchema.safeParse({
      type: 'best_exercise',
      exercise: 'Squat',
      metric: 'weight',
    });
    expect(result.success).toBe(true);
  });

  it('should validate volume_summary intent', () => {
    const result = AskIntentSchema.safeParse({
      type: 'volume_summary',
      range: 'week',
    });
    expect(result.success).toBe(true);
  });

  it('should validate last_session_summary intent', () => {
    const result = AskIntentSchema.safeParse({
      type: 'last_session_summary',
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid intent type', () => {
    const result = AskIntentSchema.safeParse({
      type: 'invalid_type',
    });
    expect(result.success).toBe(false);
  });

  it('should reject missing required fields', () => {
    const result = AskIntentSchema.safeParse({
      type: 'last_exercise_date',
      // missing exercise
    });
    expect(result.success).toBe(false);
  });
});

describe('executeAskIntent', () => {
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

  it('should return no data message for empty sessions', async () => {
    const result = await executeAskIntent(
      { type: 'last_exercise_date', exercise: 'Bench Press' },
      []
    );
    expect(result.answerText).toContain("don't have any workout data");
    expect(result.data.sources).toEqual([]);
  });

  it('should find last exercise date', async () => {
    const sessions = [
      createMockSession('2024-01-01', [{ name: 'Bench Press', sets: [{ reps: 10, weight: '135' }] }]),
      createMockSession('2024-01-15', [{ name: 'Squat', sets: [{ reps: 5, weight: '225' }] }]),
      createMockSession('2024-02-01', [{ name: 'Bench Press', sets: [{ reps: 8, weight: '145' }] }]),
    ];

    const result = await executeAskIntent(
      { type: 'last_exercise_date', exercise: 'Bench Press' },
      sessions
    );

    expect(result.data.date).toBe('2024-02-01');
    expect(result.data.matchedExercise).toBe('Bench Press');
  });

  it('should match exercise aliases like "benched" to "Bench Press"', async () => {
    const sessions = [
      createMockSession('2024-01-01', [{ name: 'Bench Press', sets: [{ reps: 10, weight: '135' }] }]),
    ];

    const result = await executeAskIntent(
      { type: 'last_exercise_date', exercise: 'benched' },
      sessions
    );

    expect(result.data.date).toBe('2024-01-01');
    expect(result.data.matchedExercise).toBe('Bench Press');
  });

  it('should match partial exercise names', async () => {
    const sessions = [
      createMockSession('2024-01-01', [{ name: 'Romanian Deadlift', sets: [{ reps: 10, weight: '135' }] }]),
    ];

    const result = await executeAskIntent(
      { type: 'last_exercise_date', exercise: 'RDL' },
      sessions
    );

    expect(result.data.date).toBe('2024-01-01');
    expect(result.data.matchedExercise).toBe('Romanian Deadlift');
  });

  it('should return suggestions for non-existent exercise', async () => {
    const sessions = [
      createMockSession('2024-01-01', [{ name: 'Bench Press', sets: [{ reps: 10, weight: '135' }] }]),
    ];

    const result = await executeAskIntent(
      { type: 'last_exercise_date', exercise: 'NonExistent Exercise' },
      sessions
    );

    expect(result.answerText).toContain("couldn't find");
    // Should have suggestions from the user's history
    expect(result.data.suggestions).toBeDefined();
  });

  it('should find last exercise details', async () => {
    const sessions = [
      createMockSession('2024-01-01', [
        {
          name: 'Deadlift',
          sets: [
            { reps: 5, weight: '315' },
            { reps: 5, weight: '315' },
            { reps: 5, weight: '325' },
          ],
        },
      ]),
    ];

    const result = await executeAskIntent(
      { type: 'last_exercise_details', exercise: 'Deadlift' },
      sessions
    );

    expect(result.data.sets).toBeDefined();
    expect(result.data.sets?.length).toBe(3);
    expect(result.data.topSet).toBeDefined();
    expect(result.data.topSet?.weight).toBe('325');
    expect(result.data.matchedExercise).toBe('Deadlift');
  });

  it('should find details using alias "dl" for Deadlift', async () => {
    const sessions = [
      createMockSession('2024-01-01', [
        {
          name: 'Deadlift',
          sets: [
            { reps: 5, weight: '315' },
          ],
        },
      ]),
    ];

    const result = await executeAskIntent(
      { type: 'last_exercise_details', exercise: 'dl' },
      sessions
    );

    expect(result.data.matchedExercise).toBe('Deadlift');
  });

  it('should find best exercise by weight', async () => {
    const sessions = [
      createMockSession('2024-01-01', [{ name: 'Squat', sets: [{ reps: 5, weight: '225' }] }]),
      createMockSession('2024-01-15', [{ name: 'Squat', sets: [{ reps: 5, weight: '245' }] }]),
      createMockSession('2024-02-01', [{ name: 'Squat', sets: [{ reps: 3, weight: '255' }] }]),
    ];

    const result = await executeAskIntent(
      { type: 'best_exercise', exercise: 'Squat', metric: 'weight' },
      sessions
    );

    expect(result.data.bestWeight).toBe(255);
    expect(result.data.bestReps).toBe(3);
  });

  it('should calculate volume summary for week', async () => {
    const now = new Date();
    // Use 3 days ago (clearly within week) and 14 days ago (clearly outside week)
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const sessions = [
      createMockSession(threeDaysAgo.toISOString().split('T')[0], [
        { name: 'Bench Press', sets: [{ reps: 10, weight: '135' }, { reps: 10, weight: '135' }] },
      ]),
      createMockSession(twoWeeksAgo.toISOString().split('T')[0], [
        { name: 'Bench Press', sets: [{ reps: 8, weight: '145' }] },
      ]),
    ];

    const result = await executeAskIntent(
      { type: 'volume_summary', exercise: 'Bench Press', range: 'week' },
      sessions
    );

    expect(result.data.setsCount).toBe(2); // Only threeDaysAgo session counts
  });

  it('should return last session summary', async () => {
    const sessions = [
      createMockSession('2024-01-01', [
        { name: 'Bench Press', sets: [{ reps: 10, weight: '135' }] },
        { name: 'Squat', sets: [{ reps: 5, weight: '225' }] },
      ]),
    ];

    const result = await executeAskIntent({ type: 'last_session_summary' }, sessions);

    expect(result.data.sessionDate).toBe('2024-01-01');
    expect(result.data.sessionExercises?.length).toBe(2);
  });
});

describe('executeAskIntent - exercise_progress', () => {
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

  it('should correctly parse weight from weightText string', async () => {
    const sessions = [
      createMockSession('2024-01-01', [
        { name: 'Bench Press', sets: [{ reps: 5, weight: '185 lbs' }] },
      ]),
      createMockSession('2024-01-15', [
        { name: 'Bench Press', sets: [{ reps: 5, weight: '195 lbs' }] },
      ]),
    ];

    const result = await executeAskIntent(
      { type: 'exercise_progress', exercise: 'Bench Press' },
      sessions
    );

    expect(result.data.progressData).toBeDefined();
    expect(result.data.progressData?.firstSession.topWeight).toBe(185);
    expect(result.data.progressData?.lastSession.topWeight).toBe(195);
    expect(result.data.progressData?.weightChange).toBe(10);
  });

  it('should correctly parse weight without units', async () => {
    const sessions = [
      createMockSession('2024-01-01', [
        { name: 'Squat', sets: [{ reps: 5, weight: '225' }] },
      ]),
      createMockSession('2024-01-15', [
        { name: 'Squat', sets: [{ reps: 5, weight: '245' }] },
      ]),
    ];

    const result = await executeAskIntent(
      { type: 'exercise_progress', exercise: 'Squat' },
      sessions
    );

    expect(result.data.progressData?.firstSession.topWeight).toBe(225);
    expect(result.data.progressData?.lastSession.topWeight).toBe(245);
    expect(result.data.progressData?.weightChange).toBe(20);
  });

  it('should detect improving trend when weight increases', async () => {
    const sessions = [
      createMockSession('2024-01-01', [
        { name: 'Deadlift', sets: [{ reps: 5, weight: '315' }] },
      ]),
      createMockSession('2024-01-15', [
        { name: 'Deadlift', sets: [{ reps: 5, weight: '335' }] },
      ]),
    ];

    const result = await executeAskIntent(
      { type: 'exercise_progress', exercise: 'Deadlift' },
      sessions
    );

    expect(result.data.progressData?.trend).toBe('improving');
    expect(result.answerText).toContain('📈');
  });

  it('should detect declining trend when weight decreases', async () => {
    const sessions = [
      createMockSession('2024-01-01', [
        { name: 'Overhead Press', sets: [{ reps: 5, weight: '135' }] },
      ]),
      createMockSession('2024-01-15', [
        { name: 'Overhead Press', sets: [{ reps: 5, weight: '115' }] },
      ]),
    ];

    const result = await executeAskIntent(
      { type: 'exercise_progress', exercise: 'Overhead Press' },
      sessions
    );

    expect(result.data.progressData?.trend).toBe('declining');
    expect(result.answerText).toContain('📉');
  });

  it('should detect stable trend when weight stays same', async () => {
    const sessions = [
      createMockSession('2024-01-01', [
        { name: 'Bench Press', sets: [{ reps: 5, weight: '185' }] },
      ]),
      createMockSession('2024-01-15', [
        { name: 'Bench Press', sets: [{ reps: 5, weight: '185' }] },
      ]),
    ];

    const result = await executeAskIntent(
      { type: 'exercise_progress', exercise: 'Bench Press' },
      sessions
    );

    expect(result.data.progressData?.trend).toBe('stable');
    expect(result.answerText).toContain('➡️');
  });

  it('should find top weight across multiple sets', async () => {
    const sessions = [
      createMockSession('2024-01-01', [
        { name: 'Bench Press', sets: [
          { reps: 10, weight: '135' },
          { reps: 8, weight: '155' },
          { reps: 5, weight: '175' }, // This is the top weight
        ]},
      ]),
      createMockSession('2024-01-15', [
        { name: 'Bench Press', sets: [
          { reps: 10, weight: '145' },
          { reps: 8, weight: '165' },
          { reps: 5, weight: '185' }, // This is the top weight
        ]},
      ]),
    ];

    const result = await executeAskIntent(
      { type: 'exercise_progress', exercise: 'Bench Press' },
      sessions
    );

    expect(result.data.progressData?.firstSession.topWeight).toBe(175);
    expect(result.data.progressData?.lastSession.topWeight).toBe(185);
    expect(result.data.progressData?.weightChange).toBe(10);
  });

  it('should match exercise using alias', async () => {
    const sessions = [
      createMockSession('2024-01-01', [
        { name: 'Bench Press', sets: [{ reps: 5, weight: '185' }] },
      ]),
      createMockSession('2024-01-15', [
        { name: 'Bench Press', sets: [{ reps: 5, weight: '195' }] },
      ]),
    ];

    // Using alias "bench" instead of "Bench Press"
    const result = await executeAskIntent(
      { type: 'exercise_progress', exercise: 'bench' },
      sessions
    );

    expect(result.data.matchedExercise).toBe('Bench Press');
    expect(result.data.progressData?.weightChange).toBe(10);
  });

  it('should handle exercise not found', async () => {
    const sessions = [
      createMockSession('2024-01-01', [
        { name: 'Bench Press', sets: [{ reps: 5, weight: '185' }] },
      ]),
    ];

    const result = await executeAskIntent(
      { type: 'exercise_progress', exercise: 'Underwater Basket Weaving' },
      sessions
    );

    expect(result.answerText).toContain("couldn't find");
    expect(result.data.suggestions).toBeDefined();
  });

  it('should handle exercise done only once', async () => {
    const sessions = [
      createMockSession('2024-01-01', [
        { name: 'Bench Press', sets: [{ reps: 5, weight: '185' }] },
      ]),
    ];

    const result = await executeAskIntent(
      { type: 'exercise_progress', exercise: 'Bench Press' },
      sessions
    );

    expect(result.answerText).toContain('once');
    expect(result.answerText).toContain('Keep training');
  });

  it('should calculate correct percentage change', async () => {
    const sessions = [
      createMockSession('2024-01-01', [
        { name: 'Squat', sets: [{ reps: 5, weight: '200' }] },
      ]),
      createMockSession('2024-01-15', [
        { name: 'Squat', sets: [{ reps: 5, weight: '220' }] },
      ]),
    ];

    const result = await executeAskIntent(
      { type: 'exercise_progress', exercise: 'Squat' },
      sessions
    );

    // 20 / 200 = 10%
    expect(result.data.progressData?.weightChangePercent).toBe(10);
  });

  it('should handle weights with decimal values', async () => {
    const sessions = [
      createMockSession('2024-01-01', [
        { name: 'Bench Press', sets: [{ reps: 5, weight: '182.5' }] },
      ]),
      createMockSession('2024-01-15', [
        { name: 'Bench Press', sets: [{ reps: 5, weight: '187.5' }] },
      ]),
    ];

    const result = await executeAskIntent(
      { type: 'exercise_progress', exercise: 'Bench Press' },
      sessions
    );

    expect(result.data.progressData?.firstSession.topWeight).toBe(182.5);
    expect(result.data.progressData?.lastSession.topWeight).toBe(187.5);
    expect(result.data.progressData?.weightChange).toBe(5);
  });

  it('should use all_time timeframe correctly', async () => {
    const sessions = [
      createMockSession('2023-01-01', [
        { name: 'Bench Press', sets: [{ reps: 5, weight: '135' }] },
      ]),
      createMockSession('2023-06-01', [
        { name: 'Bench Press', sets: [{ reps: 5, weight: '165' }] },
      ]),
      createMockSession('2024-01-01', [
        { name: 'Bench Press', sets: [{ reps: 5, weight: '185' }] },
      ]),
    ];

    const result = await executeAskIntent(
      { type: 'exercise_progress', exercise: 'Bench Press', timeframe: 'all_time' },
      sessions
    );

    // Should compare first ever session to most recent
    expect(result.data.progressData?.firstSession.topWeight).toBe(135);
    expect(result.data.progressData?.lastSession.topWeight).toBe(185);
    expect(result.data.progressData?.weightChange).toBe(50);
  });
});

