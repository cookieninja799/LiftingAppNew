import { getAskTool } from '@/ai/intents/askAgent/tools';
import { WorkoutSession, WorkoutExercise, WorkoutSet } from '@/utils/workoutSessions';

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

describe('askAgent tools', () => {
  const sessions = [
    createMockSession('2024-01-01', [{ name: 'Squat', sets: [{ reps: 5, weight: '225' }] }]),
    createMockSession('2024-01-05', [{ name: 'Squat', sets: [{ reps: 5, weight: '235' }] }]),
    createMockSession('2024-01-10', [{ name: 'Squat', sets: [{ reps: 5, weight: '245' }] }]),
    createMockSession('2024-01-15', [{ name: 'Squat', sets: [{ reps: 5, weight: '255' }] }]),
    createMockSession('2024-01-20', [{ name: 'Squat', sets: [{ reps: 5, weight: '265' }] }]),
    createMockSession('2024-01-25', [{ name: 'Squat', sets: [{ reps: 5, weight: '275' }] }]),
    createMockSession('2024-01-30', [{ name: 'Squat', sets: [{ reps: 5, weight: '285' }] }]),
  ];

  it('get_exercise_sessions honors limit and ordering', () => {
    const tool = getAskTool('get_exercise_sessions');
    if (!tool) throw new Error('Tool not found');

    const result = tool.handler(
      { exercise: 'Squat', limit: 6, sort: 'desc' },
      { sessions }
    );

    expect(result.sessions).toHaveLength(6);
    expect(result.sessions[0].date).toBe('2024-01-30');
    expect(result.sessions[5].date).toBe('2024-01-05');
  });

  it('get_exercise_progress uses last_n window', () => {
    const tool = getAskTool('get_exercise_progress');
    if (!tool) throw new Error('Tool not found');

    const result = tool.handler(
      { exercise: 'Squat', window: { type: 'last_n', n: 6 } },
      { sessions }
    );

    expect(result.sessionCount).toBe(6);
    expect(result.sessions[0].date).toBe('2024-01-05');
    expect(result.sessions[5].date).toBe('2024-01-30');
  });

  it('resolve_exercise_name suggests matches', () => {
    const tool = getAskTool('resolve_exercise_name');
    if (!tool) throw new Error('Tool not found');

    const result = tool.handler({ query: 'Squats' }, { sessions });
    expect(result.matchedExercise).toBe('Squat');
  });
});
