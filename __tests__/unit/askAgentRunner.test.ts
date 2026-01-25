import { runAskAgent } from '@/ai/intents/askAgent/runAskAgent';
import { WorkoutSession, WorkoutExercise, WorkoutSet } from '@/utils/workoutSessions';

jest.mock('@/data/AISettingsRepository', () => ({
  getSettings: jest.fn(),
  getApiKey: jest.fn(),
}));

jest.mock('@/ai/providers', () => ({
  createProvider: jest.fn(),
}));

const { getSettings, getApiKey } = jest.requireMock('@/data/AISettingsRepository');
const { createProvider } = jest.requireMock('@/ai/providers');

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

describe('runAskAgent', () => {
  const sessions = [
    createMockSession('2024-01-01', [{ name: 'Squat', sets: [{ reps: 5, weight: '225' }] }]),
    createMockSession('2024-01-05', [{ name: 'Squat', sets: [{ reps: 5, weight: '235' }] }]),
  ];

  beforeEach(() => {
    getSettings.mockResolvedValue({
      executionMode: 'byok',
      provider: 'openai',
      model: 'gpt-test',
    });
    getApiKey.mockResolvedValue('test-key');
  });

  it('returns markdown response after tool calls', async () => {
    const complete = jest.fn()
      .mockResolvedValueOnce({
        rawText: JSON.stringify({
          type: 'tool_call',
          tool: 'get_exercise_sessions',
          args: { exercise: 'Squat', limit: 6 },
        }),
      })
      .mockResolvedValueOnce({
        rawText: JSON.stringify({
          type: 'final',
          markdown: '## Squat sessions\\n- Jan 5\\n- Jan 1',
        }),
      });

    createProvider.mockReturnValue({ complete });

    const result = await runAskAgent('last 6 squat sessions', sessions);
    expect(result).not.toBeNull();
    expect(result?.answerMarkdown).toContain('Squat sessions');
  });

  it('returns null on repeated invalid tool calls', async () => {
    const complete = jest.fn()
      .mockResolvedValueOnce({
        rawText: JSON.stringify({
          type: 'tool_call',
          tool: 'unknown_tool',
          args: {},
        }),
      })
      .mockResolvedValueOnce({
        rawText: JSON.stringify({
          type: 'tool_call',
          tool: 'unknown_tool',
          args: {},
        }),
      });

    createProvider.mockReturnValue({ complete });

    const result = await runAskAgent('last 6 squat sessions', sessions);
    expect(result).toBeNull();
  });
});
