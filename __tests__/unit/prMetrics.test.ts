// __tests__/unit/prMetrics.test.ts
import {
    calculatePRMetrics,
    filterPRMetricsBySearch,
    getTopPRs,
    getE1RMConfidence,
    PRMetric,
    sortPRMetricsByWeight,
} from '../../utils/pr/calculatePRMetrics';
import {
    bodyweightSessions,
    emptySessions,
    prTestSessions
} from '../fixtures/sessions';

describe('calculatePRMetrics', () => {
  describe('PR selection - highest weight wins', () => {
    it('should select highest weight as PR', () => {
      const prMetrics = calculatePRMetrics(prTestSessions);
      const benchPR = prMetrics.find(pr => pr.exercise.toLowerCase() === 'bench press');

      // Highest bench press weight is 205 lbs
      expect(benchPR?.maxWeight).toBe(205);
    });

    it('should record date of PR achievement', () => {
      const prMetrics = calculatePRMetrics(prTestSessions);
      const benchPR = prMetrics.find(pr => pr.exercise.toLowerCase() === 'bench press');

      // 205 lbs @ 5 reps was achieved on 2024-12-12
      expect(benchPR?.date).toBe('2024-12-12');
    });
  });

  describe('e1RM + confidence', () => {
    it('should attach estimated 1RM and confidence based on PR set', () => {
      const prMetrics = calculatePRMetrics(prTestSessions, { referenceDate: '2024-12-20' });
      const benchPR = prMetrics.find(pr => pr.exercise.toLowerCase() === 'bench press');

      // e1RM (Epley) = 205 * (1 + 5/30) = 239.166...
      expect(benchPR?.estimated1RM).toBeCloseTo(239.166, 2);
      expect(benchPR?.e1rmConfidence).toBe('high');
    });

    it('should treat bodyweight/unparsed loads as low confidence with missing e1RM', () => {
      const prMetrics = calculatePRMetrics(bodyweightSessions, { referenceDate: '2024-12-20' });
      const pullUpPR = prMetrics.find(pr => pr.exercise.toLowerCase() === 'pull-ups');

      expect(pullUpPR?.estimated1RM).toBeUndefined();
      expect(pullUpPR?.e1rmConfidence).toBe('low');
      expect(pullUpPR?.e1rmConfidenceReasons).toContain('bodyweight/unparsed load');
    });
  });

  describe('tie-break by reps', () => {
    it('should select higher reps when weights are equal', () => {
      const prMetrics = calculatePRMetrics(prTestSessions);
      const benchPR = prMetrics.find(pr => pr.exercise.toLowerCase() === 'bench press');

      // At 205 lbs, there are two entries: 3 reps and 5 reps
      // The 5 rep version should win the tie-break
      expect(benchPR?.reps).toBe(5);
    });
  });

  describe('multiple exercises', () => {
    it('should calculate PRs for each unique exercise', () => {
      const prMetrics = calculatePRMetrics(prTestSessions);

      expect(prMetrics).toHaveLength(2); // Bench Press and Squats
      expect(prMetrics.some(pr => pr.exercise.toLowerCase() === 'bench press')).toBe(true);
      expect(prMetrics.some(pr => pr.exercise.toLowerCase() === 'squats')).toBe(true);
    });

    it('should get correct PR for each exercise', () => {
      const prMetrics = calculatePRMetrics(prTestSessions);
      const squatPR = prMetrics.find(pr => pr.exercise.toLowerCase() === 'squats');

      expect(squatPR?.maxWeight).toBe(315);
      expect(squatPR?.reps).toBe(3);
    });
  });

  describe('edge cases', () => {
    it('should return empty array for empty sessions', () => {
      const prMetrics = calculatePRMetrics(emptySessions);
      expect(prMetrics).toHaveLength(0);
    });

    it('should handle exercises with string weights (bodyweight)', () => {
      const prMetrics = calculatePRMetrics(bodyweightSessions);
      const pullUpPR = prMetrics.find(pr => pr.exercise.toLowerCase() === 'pull-ups');
      
      // 'bodyweight' parses to 0 with parseFloat
      expect(pullUpPR?.maxWeight).toBe(0);
    });

    it('should handle weighted bodyweight exercises', () => {
      const prMetrics = calculatePRMetrics(bodyweightSessions);
      const weightedPR = prMetrics.find(pr => pr.exercise.toLowerCase() === 'weighted pull-ups');

      // Highest weight added: 45 lbs
      expect(weightedPR?.maxWeight).toBe(45);
    });

    it('should handle multiple sets with same weight - highest reps wins', () => {
      const now = new Date().toISOString();
      const sessions: WorkoutSession[] = [
        {
          id: 'session-1',
          performedOn: '2024-12-18',
          exercises: [
            {
              id: 'ex-1',
              sessionId: 'session-1',
              nameRaw: 'Bench Press',
              primaryMuscleGroup: 'Chest',
              sets: [
                {
                  id: 'set-1',
                  exerciseId: 'ex-1',
                  setIndex: 0,
                  reps: 8,
                  weightText: '135',
                  isBodyweight: false,
                  updatedAt: now,
                  createdAt: now,
                },
                {
                  id: 'set-2',
                  exerciseId: 'ex-1',
                  setIndex: 1,
                  reps: 10,
                  weightText: '135',
                  isBodyweight: false,
                  updatedAt: now,
                  createdAt: now,
                },
                {
                  id: 'set-3',
                  exerciseId: 'ex-1',
                  setIndex: 2,
                  reps: 6,
                  weightText: '135',
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

      const prMetrics = calculatePRMetrics(sessions);
      const benchPR = prMetrics.find(pr => pr.exercise.toLowerCase() === 'bench press');

      expect(benchPR?.maxWeight).toBe(135);
      expect(benchPR?.reps).toBe(10); // Highest reps at this weight
    });

    it('should be case-insensitive for exercise names', () => {
      const now = new Date().toISOString();
      const sessions: WorkoutSession[] = [
        {
          id: 'session-1',
          performedOn: '2024-12-17',
          exercises: [
            {
              id: 'ex-1',
              sessionId: 'session-1',
              nameRaw: 'BENCH PRESS',
              primaryMuscleGroup: 'Chest',
              sets: [
                {
                  id: 'set-1',
                  exerciseId: 'ex-1',
                  setIndex: 0,
                  reps: 5,
                  weightText: '225',
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
          performedOn: '2024-12-18',
          exercises: [
            {
              id: 'ex-2',
              sessionId: 'session-2',
              nameRaw: 'bench press', // Different casing
              primaryMuscleGroup: 'Chest',
              sets: [
                {
                  id: 'set-2',
                  exerciseId: 'ex-2',
                  setIndex: 0,
                  reps: 3,
                  weightText: '235', // Higher weight
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

      const prMetrics = calculatePRMetrics(sessions);
      
      // Should combine into one PR (case-insensitive)
      const benchPRs = prMetrics.filter(pr => pr.exercise.toLowerCase() === 'bench press');
      expect(benchPRs).toHaveLength(1);
      expect(benchPRs[0].maxWeight).toBe(235);
    });
  });
});

describe('getE1RMConfidence', () => {
  it('should be deterministic with a fixed referenceDate', () => {
    const { confidence } = getE1RMConfidence({
      reps: 5,
      prDate: '2024-12-12',
      referenceDate: '2024-12-20',
    });

    expect(confidence).toBe('high');
  });
});

describe('filterPRMetricsBySearch', () => {
  const testMetrics: PRMetric[] = [
    { exercise: 'Bench Press', maxWeight: 225, reps: 5, date: '2024-12-18' },
    { exercise: 'Incline Bench Press', maxWeight: 185, reps: 8, date: '2024-12-17' },
    { exercise: 'Squats', maxWeight: 315, reps: 3, date: '2024-12-16' },
    { exercise: 'Deadlift', maxWeight: 405, reps: 1, date: '2024-12-15' },
  ];

  it('should filter by partial match', () => {
    const filtered = filterPRMetricsBySearch(testMetrics, 'bench');

    expect(filtered).toHaveLength(2);
    expect(filtered.every(m => m.exercise.toLowerCase().includes('bench'))).toBe(true);
  });

  it('should be case-insensitive', () => {
    const filtered = filterPRMetricsBySearch(testMetrics, 'BENCH');

    expect(filtered).toHaveLength(2);
  });

  it('should return all metrics for empty search', () => {
    const filtered = filterPRMetricsBySearch(testMetrics, '');

    expect(filtered).toHaveLength(4);
  });

  it('should return all metrics for whitespace-only search', () => {
    const filtered = filterPRMetricsBySearch(testMetrics, '   ');

    expect(filtered).toHaveLength(4);
  });

  it('should return empty array when no matches', () => {
    const filtered = filterPRMetricsBySearch(testMetrics, 'tricep');

    expect(filtered).toHaveLength(0);
  });
});

describe('sortPRMetricsByWeight', () => {
  const testMetrics: PRMetric[] = [
    { exercise: 'Bench Press', maxWeight: 225, reps: 5, date: '2024-12-18' },
    { exercise: 'Deadlift', maxWeight: 405, reps: 1, date: '2024-12-15' },
    { exercise: 'Squats', maxWeight: 315, reps: 3, date: '2024-12-16' },
  ];

  it('should sort by weight descending', () => {
    const sorted = sortPRMetricsByWeight(testMetrics);

    expect(sorted[0].maxWeight).toBe(405);
    expect(sorted[1].maxWeight).toBe(315);
    expect(sorted[2].maxWeight).toBe(225);
  });

  it('should not mutate original array', () => {
    const original = [...testMetrics];
    sortPRMetricsByWeight(testMetrics);

    expect(testMetrics[0].exercise).toBe(original[0].exercise);
  });
});

describe('getTopPRs', () => {
  const testMetrics: PRMetric[] = [
    { exercise: 'Bench Press', maxWeight: 225, reps: 5, date: '2024-12-18' },
    { exercise: 'Deadlift', maxWeight: 405, reps: 1, date: '2024-12-15' },
    { exercise: 'Squats', maxWeight: 315, reps: 3, date: '2024-12-16' },
    { exercise: 'Overhead Press', maxWeight: 135, reps: 8, date: '2024-12-14' },
  ];

  it('should return top N PRs by weight', () => {
    const top2 = getTopPRs(testMetrics, 2);

    expect(top2).toHaveLength(2);
    expect(top2[0].exercise).toBe('Deadlift');
    expect(top2[1].exercise).toBe('Squats');
  });

  it('should return all if count exceeds length', () => {
    const top10 = getTopPRs(testMetrics, 10);

    expect(top10).toHaveLength(4);
  });

  it('should return empty array for count of 0', () => {
    const top0 = getTopPRs(testMetrics, 0);

    expect(top0).toHaveLength(0);
  });
});
