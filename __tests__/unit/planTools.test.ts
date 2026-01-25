import { getPlanTool } from '@/ai/intents/planAgent/tools';
import { planToolSessions, createMockSession } from '@/__tests__/fixtures/planSessions';

describe('planAgent tools', () => {
  it('get_recent_workouts returns recent sessions', () => {
    const tool = getPlanTool('get_recent_workouts');
    if (!tool) throw new Error('Tool not found');

    const result = tool.handler({ days: 10, includeMuscleGroups: true }, { sessions: planToolSessions });
    expect(result.sessionCount).toBe(3);
    expect(result.workouts[0].date).toBe('2026-01-24');
    expect(result.workouts[0].muscleGroups).toContain('Chest');
  });

  it('get_exercise_working_weights returns history', () => {
    const tool = getPlanTool('get_exercise_working_weights');
    if (!tool) throw new Error('Tool not found');

    const result = tool.handler({ exercise: 'Bench Press', limit: 2 }, { sessions: planToolSessions });
    expect(result.matchedExercise).toBe('Bench Press');
    expect(result.history).toHaveLength(2);
    expect(result.history[0].topWeight).toBe(185);
  });

  it('get_exercise_working_weights returns suggestions for unknown exercise', () => {
    const tool = getPlanTool('get_exercise_working_weights');
    if (!tool) throw new Error('Tool not found');

    const result = tool.handler({ exercise: 'Incline Bench', limit: 2 }, { sessions: planToolSessions });
    expect(result.matchedExercise).toBeNull();
    expect(Array.isArray(result.suggestions)).toBe(true);
  });

  it('calculate_recommended_weight applies gradual progression', () => {
    const tool = getPlanTool('calculate_recommended_weight');
    if (!tool) throw new Error('Tool not found');

    const result = tool.handler(
      {
        exercise: 'Bench Press',
        targetReps: 8,
        goal: 'hypertrophy',
        progressionStyle: 'gradual',
      },
      { sessions: planToolSessions }
    );

    expect(result.success).toBe(true);
    expect(result.recommendedWeight).toBe(187.5);
    expect(result.confidence).toBe('high');
  });

  it('calculate_recommended_weight applies deload', () => {
    const tool = getPlanTool('calculate_recommended_weight');
    if (!tool) throw new Error('Tool not found');

    const sessions = [
      createMockSession('2026-01-24', [{ name: 'Squat', sets: [{ reps: 5, weight: '300' }] }], {
        Squat: 'Quads',
      }),
    ];

    const result = tool.handler(
      {
        exercise: 'Squat',
        targetReps: 5,
        goal: 'strength',
        progressionStyle: 'deload',
      },
      { sessions }
    );

    expect(result.success).toBe(true);
    expect(result.recommendedWeight).toBe(240);
  });

  it('check_muscle_recovery returns recovery status', () => {
    const tool = getPlanTool('check_muscle_recovery');
    if (!tool) throw new Error('Tool not found');

    const result = tool.handler({ muscleGroup: 'Chest' }, { sessions: planToolSessions });
    expect(result.lastTrainedDate).toBe('2026-01-24');
    expect(['needs_rest', 'partial', 'recovered']).toContain(result.recoveryStatus);
  });

  it('estimate_weight_from_similar returns estimated weight', () => {
    const tool = getPlanTool('estimate_weight_from_similar');
    if (!tool) throw new Error('Tool not found');

    const result = tool.handler(
      {
        targetExercise: 'Incline Bench Press',
        targetReps: 8,
        goal: 'hypertrophy',
      },
      { sessions: planToolSessions }
    );

    expect(result.success).toBe(true);
    expect(result.recommendedWeight).toBe(150);
    expect(result.basedOnExercise).toBe('Bench Press');
  });

  it('get_exercise_alternative returns alternatives', () => {
    const tool = getPlanTool('get_exercise_alternative');
    if (!tool) throw new Error('Tool not found');

    const result = tool.handler({ exercise: 'Bench Press', reason: 'equipment' }, { sessions: planToolSessions });
    expect(result.alternatives).toContain('dumbbell bench press');
  });

  it('find_similar_exercises_by_pattern matches user history', () => {
    const tool = getPlanTool('find_similar_exercises_by_pattern');
    if (!tool) throw new Error('Tool not found');

    const result = tool.handler({ movementPattern: 'horizontal_press' }, { sessions: planToolSessions });
    expect(result.matches).toContain('Bench Press');
  });
});
