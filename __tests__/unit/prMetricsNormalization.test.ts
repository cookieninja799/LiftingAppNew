import { calculatePRMetrics } from '../../utils/pr/calculatePRMetrics';
import { WorkoutSession } from '../../utils/workoutSessions';

describe('calculatePRMetrics normalization', () => {
  it('groups PRs by normalized exercise name', () => {
    const now = new Date().toISOString();
    const sessions: WorkoutSession[] = [
      {
        id: 'session-1',
        performedOn: '2024-12-18',
        exercises: [
          {
            id: 'ex-1',
            sessionId: 'session-1',
            nameRaw: 'Cable Row',
            sets: [
              {
                id: 'set-1',
                exerciseId: 'ex-1',
                setIndex: 0,
                reps: 8,
                weightText: '120',
                isBodyweight: false,
                updatedAt: now,
                createdAt: now,
              },
            ],
            updatedAt: now,
            createdAt: now,
          },
        ],
        updatedAt: now,
        createdAt: now,
      },
      {
        id: 'session-2',
        performedOn: '2024-12-19',
        exercises: [
          {
            id: 'ex-2',
            sessionId: 'session-2',
            nameRaw: 'Cable Rows',
            sets: [
              {
                id: 'set-2',
                exerciseId: 'ex-2',
                setIndex: 0,
                reps: 6,
                weightText: '130',
                isBodyweight: false,
                updatedAt: now,
                createdAt: now,
              },
            ],
            updatedAt: now,
            createdAt: now,
          },
        ],
        updatedAt: now,
        createdAt: now,
      },
    ];

    const metrics = calculatePRMetrics(sessions);
    expect(metrics).toHaveLength(1);
    expect(metrics[0].exercise).toBe('cable row');
    expect(metrics[0].maxWeight).toBe(130);
    expect(metrics[0].variations).toEqual(['Cable Row', 'Cable Rows']);
  });
});
