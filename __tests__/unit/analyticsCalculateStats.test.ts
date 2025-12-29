// __tests__/unit/analyticsCalculateStats.test.ts
import {
    calculateStatsFromSessions,
    getEmptyStats
} from '../../utils/analytics/calculateStats';
import {
    emptySessions,
    fractionalSetsSessions,
    getTestCurrentWeek,
    multipleSessions,
    multiWeekSessions,
    singleSession,
    uncategorizedExercisesSessions
} from '../fixtures/sessions';

// Mock the helpers module to control bodyweight
jest.mock('../../utils/helpers', () => ({
  ...jest.requireActual('../../utils/helpers'),
  getUserBodyWeight: () => 180, // Fixed bodyweight for testing
}));

describe('calculateStatsFromSessions', () => {
  const currentWeek = getTestCurrentWeek(); // '2024-W51'

  describe('markedDates (total sets per day)', () => {
    it('should calculate total sets per day for heatmap', () => {
      const { markedDates } = calculateStatsFromSessions(singleSession, {
        currentWeek,
      });

      // singleSession has 2 exercises with 3 sets each on 2024-12-18
      expect(markedDates['2024-12-18']).toBe(6);
    });

    it('should track multiple days separately', () => {
      const { markedDates } = calculateStatsFromSessions(multipleSessions, {
        currentWeek,
      });

      // Session 1: 2024-12-18, 3+4=7 sets
      expect(markedDates['2024-12-18']).toBe(7);
      // Session 2: 2024-12-17, 5+3=8 sets
      expect(markedDates['2024-12-17']).toBe(8);
      // Session 3: 2024-12-10, 4 sets
      expect(markedDates['2024-12-10']).toBe(4);
    });

    it('should return empty object for no sessions', () => {
      const { markedDates } = calculateStatsFromSessions(emptySessions, {
        currentWeek,
      });

      expect(Object.keys(markedDates)).toHaveLength(0);
    });
  });

  describe('totalWorkoutDays', () => {
    it('should count total workout days', () => {
      const { workoutStats } = calculateStatsFromSessions(multipleSessions, {
        currentWeek,
      });

      expect(workoutStats.totalWorkoutDays).toBe(3);
    });

    it('should return 0 for empty sessions', () => {
      const { workoutStats } = calculateStatsFromSessions(emptySessions, {
        currentWeek,
      });

      expect(workoutStats.totalWorkoutDays).toBe(0);
    });
  });

  describe('averageExercisesPerDay', () => {
    it('should calculate average exercises per day', () => {
      const { workoutStats } = calculateStatsFromSessions(singleSession, {
        currentWeek,
      });

      // 2 exercises in 1 day = 2.0
      expect(workoutStats.averageExercisesPerDay).toBe(2);
    });

    it('should calculate across multiple days', () => {
      const { workoutStats } = calculateStatsFromSessions(multipleSessions, {
        currentWeek,
      });

      // 5 exercises across 3 days = 5/3 ≈ 1.67
      expect(workoutStats.averageExercisesPerDay).toBeCloseTo(5 / 3, 2);
    });

    it('should return 0 for empty sessions', () => {
      const { workoutStats } = calculateStatsFromSessions(emptySessions, {
        currentWeek,
      });

      expect(workoutStats.averageExercisesPerDay).toBe(0);
    });
  });

  describe('averageSetsPerDay', () => {
    it('should calculate average sets per day', () => {
      const { workoutStats } = calculateStatsFromSessions(singleSession, {
        currentWeek,
      });

      // 6 sets in 1 day = 6.0
      expect(workoutStats.averageSetsPerDay).toBe(6);
    });

    it('should calculate across multiple days', () => {
      const { workoutStats } = calculateStatsFromSessions(multipleSessions, {
        currentWeek,
      });

      // Session 1: 7 sets, Session 2: 8 sets, Session 3: 4 sets = 19 total, 3 days
      expect(workoutStats.averageSetsPerDay).toBeCloseTo(19 / 3, 2);
    });
  });

  describe('mostCommonExercise', () => {
    it('should find most common exercise', () => {
      const { workoutStats } = calculateStatsFromSessions(multipleSessions, {
        currentWeek,
      });

      // Bench Press appears twice (session 1 and 2)
      expect(workoutStats.mostCommonExercise).toBe('bench press');
    });

    it('should return N/A for empty sessions', () => {
      const { workoutStats } = calculateStatsFromSessions(emptySessions, {
        currentWeek,
      });

      expect(workoutStats.mostCommonExercise).toBe('N/A');
    });

    it('should handle single exercise', () => {
      const now = new Date().toISOString();
      const { workoutStats } = calculateStatsFromSessions(
        [
          {
            id: 'session-1',
            performedOn: '2024-12-18',
            exercises: [
              {
                id: 'ex-1',
                sessionId: 'session-1',
                nameRaw: 'Deadlift',
                sets: [
                  { id: 's1', exerciseId: 'ex-1', setIndex: 0, reps: 5, weightText: '315', updatedAt: now, createdAt: now },
                  { id: 's2', exerciseId: 'ex-1', setIndex: 1, reps: 5, weightText: '315', updatedAt: now, createdAt: now },
                  { id: 's3', exerciseId: 'ex-1', setIndex: 2, reps: 5, weightText: '315', updatedAt: now, createdAt: now },
                  { id: 's4', exerciseId: 'ex-1', setIndex: 3, reps: 5, weightText: '315', updatedAt: now, createdAt: now },
                  { id: 's5', exerciseId: 'ex-1', setIndex: 4, reps: 5, weightText: '315', updatedAt: now, createdAt: now },
                ],
                primaryMuscleGroup: 'Back',
                updatedAt: now,
                createdAt: now,
              },
            ],
            updatedAt: now,
            createdAt: now,
          },
        ],
        { currentWeek }
      );

      expect(workoutStats.mostCommonExercise).toBe('deadlift');
    });
  });

  describe('muscleGroupStats', () => {
    it('should calculate weekly sets for muscle groups with direct/fractional/total breakdown', () => {
      const { workoutStats } = calculateStatsFromSessions(multiWeekSessions, {
        currentWeek: '2024-W51',
      });

      // Week 51 has Chest exercises: 4 sets + 3 sets = 7 touched sets
      // Both exercises have primaryMuscleGroup = 'Chest', so template gives Chest 1.0 direct
      expect(workoutStats.muscleGroupStats['Chest']).toBeDefined();
      expect(workoutStats.muscleGroupStats['Chest'].weeklySets.touched['2024-W51']).toBe(7);
      expect(workoutStats.muscleGroupStats['Chest'].weeklySets.direct['2024-W51']).toBe(7);
      expect(workoutStats.muscleGroupStats['Chest'].weeklySets.fractional['2024-W51']).toBe(7);
    });

    it('should track sets from different weeks separately', () => {
      const { workoutStats } = calculateStatsFromSessions(multiWeekSessions, {
        currentWeek: '2024-W51',
      });

      // Week 50 has Chest: 3 sets
      expect(workoutStats.muscleGroupStats['Chest'].weeklySets.touched['2024-W50']).toBe(3);
      // Week 49 has Quads: 5 sets
      expect(workoutStats.muscleGroupStats['Quads'].weeklySets.touched['2024-W49']).toBe(5);
    });

    it('should handle missing muscle groups by tracking as uncategorized', () => {
      const { workoutStats } = calculateStatsFromSessions(
        uncategorizedExercisesSessions,
        { currentWeek }
      );

      // Should NOT create an "Unknown" muscle group entry
      expect(workoutStats.muscleGroupStats['Unknown']).toBeUndefined();
      // Should track uncategorized sets
      expect(workoutStats.uncategorized.weeklySets['2024-W51']).toBe(3); // Mystery Machine has 3 sets
      expect(workoutStats.uncategorized.weeklyExerciseCount['2024-W51']).toBe(1);
      // Chest should still be tracked normally
      expect(workoutStats.muscleGroupStats['Chest']).toBeDefined();
    });

    it('should calculate average volume for current week', () => {
      const { workoutStats } = calculateStatsFromSessions(multiWeekSessions, {
        currentWeek: '2024-W51',
      });

      // Chest has 2 exercises (sessions) in week 51
      expect(workoutStats.muscleGroupStats['Chest'].averageVolume).toBeGreaterThan(0);
    });

    it('should calculate fractional sets from templates (Bench Press)', () => {
      const { workoutStats } = calculateStatsFromSessions(fractionalSetsSessions, {
        currentWeek: '2024-W51',
      });

      // Bench Press: 3 sets -> Chest direct 3, Arms fractional 1.5, Shoulders fractional 1.5
      // Row: 4 sets -> Back direct 4, Arms fractional 2, Shoulders fractional 2
      // Squats: 4 sets -> Quads direct 4, Hamstrings fractional 1

      // Chest: 3 direct, 3 touched
      expect(workoutStats.muscleGroupStats['Chest'].weeklySets.direct['2024-W51']).toBe(3);
      expect(workoutStats.muscleGroupStats['Chest'].weeklySets.fractional['2024-W51']).toBe(3);
      expect(workoutStats.muscleGroupStats['Chest'].weeklySets.touched['2024-W51']).toBe(3);

      // Arms: 0 direct (both exercises have arms as secondary), 3.5 fractional (1.5 + 2)
      // touched = 7 (3 from bench + 4 from row)
      expect(workoutStats.muscleGroupStats['Arms'].weeklySets.direct['2024-W51']).toBe(0);
      expect(workoutStats.muscleGroupStats['Arms'].weeklySets.fractional['2024-W51']).toBe(3.5);
      expect(workoutStats.muscleGroupStats['Arms'].weeklySets.touched['2024-W51']).toBe(7);

      // Shoulders: 0 direct, 3.5 fractional (1.5 + 2), 7 touched
      expect(workoutStats.muscleGroupStats['Shoulders'].weeklySets.direct['2024-W51']).toBe(0);
      expect(workoutStats.muscleGroupStats['Shoulders'].weeklySets.fractional['2024-W51']).toBe(3.5);
      expect(workoutStats.muscleGroupStats['Shoulders'].weeklySets.touched['2024-W51']).toBe(7);

      // Back: 4 direct, 4 fractional, 4 touched
      expect(workoutStats.muscleGroupStats['Back'].weeklySets.direct['2024-W51']).toBe(4);
      expect(workoutStats.muscleGroupStats['Back'].weeklySets.fractional['2024-W51']).toBe(4);
      expect(workoutStats.muscleGroupStats['Back'].weeklySets.touched['2024-W51']).toBe(4);

      // Quads: 4 direct, 4 fractional, 4 touched
      expect(workoutStats.muscleGroupStats['Quads'].weeklySets.direct['2024-W51']).toBe(4);
      expect(workoutStats.muscleGroupStats['Quads'].weeklySets.fractional['2024-W51']).toBe(4);
      expect(workoutStats.muscleGroupStats['Quads'].weeklySets.touched['2024-W51']).toBe(4);

      // Hamstrings: 0 direct, 1 fractional (4 * 0.25), 4 touched
      expect(workoutStats.muscleGroupStats['Hamstrings'].weeklySets.direct['2024-W51']).toBe(0);
      expect(workoutStats.muscleGroupStats['Hamstrings'].weeklySets.fractional['2024-W51']).toBe(1);
      expect(workoutStats.muscleGroupStats['Hamstrings'].weeklySets.touched['2024-W51']).toBe(4);
    });

    it('should treat primaryMuscleGroup as direct even if assistant-provided fractions are imperfect', () => {
      const now = new Date().toISOString();
      const sessions = [
        {
          id: 'session-1',
          performedOn: '2024-12-18',
          exercises: [
            {
              id: 'ex-1',
              sessionId: 'session-1',
              nameRaw: 'Squats',
              // Assistant says Quads is primary but provides a non-1.0 fraction (seen in the wild).
              primaryMuscleGroup: 'Quads',
              muscleContributions: [
                { muscleGroup: 'Quads', fraction: 0.5 },
                { muscleGroup: 'Hamstrings', fraction: 0.25 },
              ],
              sets: [
                { id: 's1', exerciseId: 'ex-1', setIndex: 0, reps: 8, weightText: '135', updatedAt: now, createdAt: now },
                { id: 's2', exerciseId: 'ex-1', setIndex: 1, reps: 8, weightText: '135', updatedAt: now, createdAt: now },
                { id: 's3', exerciseId: 'ex-1', setIndex: 2, reps: 8, weightText: '135', updatedAt: now, createdAt: now },
              ],
              updatedAt: now,
              createdAt: now,
            },
          ],
          updatedAt: now,
          createdAt: now,
        },
      ];

      const { workoutStats } = calculateStatsFromSessions(sessions as any, {
        currentWeek: '2024-W51',
      });

      // Quads should be counted as direct sets because it's the primary muscle group.
      expect(workoutStats.muscleGroupStats['Quads'].weeklySets.direct['2024-W51']).toBe(3);
      expect(workoutStats.muscleGroupStats['Quads'].weeklySets.fractional['2024-W51']).toBe(3);
      expect(workoutStats.muscleGroupStats['Quads'].weeklySets.touched['2024-W51']).toBe(3);

      // Hamstrings stays secondary.
      expect(workoutStats.muscleGroupStats['Hamstrings'].weeklySets.direct['2024-W51']).toBe(0);
      expect(workoutStats.muscleGroupStats['Hamstrings'].weeklySets.fractional['2024-W51']).toBe(0.75);
      expect(workoutStats.muscleGroupStats['Hamstrings'].weeklySets.touched['2024-W51']).toBe(3);
    });

    it('should calculate direct-only volume (literature standard)', () => {
      const { workoutStats } = calculateStatsFromSessions(fractionalSetsSessions, {
        currentWeek: '2024-W51',
      });

      // Bench Press: 3 sets x 135 lbs = 405 lbs per set, total = 1215 lbs (Chest only gets this as direct)
      // Arms and Shoulders get 0 direct volume from Bench Press (fraction < 1)
      
      // Chest should have direct volume > 0
      expect(workoutStats.muscleGroupStats['Chest'].totalVolumeDirect).toBeGreaterThan(0);
      
      // Arms should have 0 direct volume (no exercises where Arms is primary)
      expect(workoutStats.muscleGroupStats['Arms'].totalVolumeDirect).toBe(0);
      
      // Shoulders should have 0 direct volume (no exercises where Shoulders is primary)
      expect(workoutStats.muscleGroupStats['Shoulders'].totalVolumeDirect).toBe(0);
      
      // Back should have direct volume from Row
      expect(workoutStats.muscleGroupStats['Back'].totalVolumeDirect).toBeGreaterThan(0);
      
      // Quads should have direct volume from Squats
      expect(workoutStats.muscleGroupStats['Quads'].totalVolumeDirect).toBeGreaterThan(0);
      
      // Hamstrings should have 0 direct volume (only gets secondary contribution from Squats)
      expect(workoutStats.muscleGroupStats['Hamstrings'].totalVolumeDirect).toBe(0);
    });

    it('should calculate allocated volume (fraction-weighted)', () => {
      const { workoutStats } = calculateStatsFromSessions(fractionalSetsSessions, {
        currentWeek: '2024-W51',
      });

      // All muscle groups should have allocated volume > 0 if they're involved
      expect(workoutStats.muscleGroupStats['Chest'].totalVolumeAllocated).toBeGreaterThan(0);
      expect(workoutStats.muscleGroupStats['Arms'].totalVolumeAllocated).toBeGreaterThan(0);
      expect(workoutStats.muscleGroupStats['Shoulders'].totalVolumeAllocated).toBeGreaterThan(0);
      expect(workoutStats.muscleGroupStats['Back'].totalVolumeAllocated).toBeGreaterThan(0);
      expect(workoutStats.muscleGroupStats['Quads'].totalVolumeAllocated).toBeGreaterThan(0);
      expect(workoutStats.muscleGroupStats['Hamstrings'].totalVolumeAllocated).toBeGreaterThan(0);
      
      // For primary muscles, direct volume should equal allocated volume
      expect(workoutStats.muscleGroupStats['Chest'].totalVolumeDirect).toBe(
        workoutStats.muscleGroupStats['Chest'].totalVolumeAllocated
      );
      expect(workoutStats.muscleGroupStats['Back'].totalVolumeDirect).toBe(
        workoutStats.muscleGroupStats['Back'].totalVolumeAllocated
      );
      expect(workoutStats.muscleGroupStats['Quads'].totalVolumeDirect).toBe(
        workoutStats.muscleGroupStats['Quads'].totalVolumeAllocated
      );
      
      // For secondary muscles, allocated volume > direct volume (direct = 0)
      expect(workoutStats.muscleGroupStats['Arms'].totalVolumeAllocated).toBeGreaterThan(
        workoutStats.muscleGroupStats['Arms'].totalVolumeDirect
      );
      expect(workoutStats.muscleGroupStats['Shoulders'].totalVolumeAllocated).toBeGreaterThan(
        workoutStats.muscleGroupStats['Shoulders'].totalVolumeDirect
      );
      expect(workoutStats.muscleGroupStats['Hamstrings'].totalVolumeAllocated).toBeGreaterThan(
        workoutStats.muscleGroupStats['Hamstrings'].totalVolumeDirect
      );
    });

    it('should calculate average volumes correctly', () => {
      const { workoutStats } = calculateStatsFromSessions(fractionalSetsSessions, {
        currentWeek: '2024-W51',
      });

      // All muscle groups should have average volumes
      expect(workoutStats.muscleGroupStats['Chest'].averageVolumeDirect).toBeGreaterThan(0);
      expect(workoutStats.muscleGroupStats['Chest'].averageVolumeAllocated).toBeGreaterThan(0);
      
      // For primary muscles, average direct = average allocated
      expect(workoutStats.muscleGroupStats['Chest'].averageVolumeDirect).toBe(
        workoutStats.muscleGroupStats['Chest'].averageVolumeAllocated
      );
      
      // For secondary muscles, average allocated > average direct (direct = 0)
      expect(workoutStats.muscleGroupStats['Arms'].averageVolumeDirect).toBe(0);
      expect(workoutStats.muscleGroupStats['Arms'].averageVolumeAllocated).toBeGreaterThan(0);
    });

    it('should not count secondary muscle volume as direct volume', () => {
      const now = new Date().toISOString();
      // Create a session with just Bench Press to verify volume calculations
      const benchOnlySessions = [
        {
          id: 'session-1',
          performedOn: '2024-12-18',
          exercises: [
            {
              id: 'ex-1',
              sessionId: 'session-1',
              nameRaw: 'Bench Press',
              sets: [
                { id: 's1', exerciseId: 'ex-1', setIndex: 0, reps: 5, weightText: '135', updatedAt: now, createdAt: now },
                { id: 's2', exerciseId: 'ex-1', setIndex: 1, reps: 5, weightText: '135', updatedAt: now, createdAt: now },
                { id: 's3', exerciseId: 'ex-1', setIndex: 2, reps: 5, weightText: '135', updatedAt: now, createdAt: now },
              ],
              primaryMuscleGroup: 'Chest',
              updatedAt: now,
              createdAt: now,
            },
          ],
          updatedAt: now,
          createdAt: now,
        },
      ];

      const { workoutStats } = calculateStatsFromSessions(benchOnlySessions, {
        currentWeek: '2024-W51',
      });

      // Chest gets full volume as direct (primary muscle)
      const chestDirectVolume = workoutStats.muscleGroupStats['Chest'].totalVolumeDirect;
      expect(chestDirectVolume).toBeGreaterThan(0);
      
      // Arms get allocated volume but 0 direct volume
      const armsDirectVolume = workoutStats.muscleGroupStats['Arms'].totalVolumeDirect;
      const armsAllocatedVolume = workoutStats.muscleGroupStats['Arms'].totalVolumeAllocated;
      expect(armsDirectVolume).toBe(0);
      expect(armsAllocatedVolume).toBeGreaterThan(0);
      
      // Arms allocated should be less than Chest direct (Arms only gets 0.5 fraction)
      expect(armsAllocatedVolume).toBeLessThan(chestDirectVolume);
      
      // Arms allocated should be approximately 50% of Chest direct (0.5 fraction)
      expect(armsAllocatedVolume).toBeCloseTo(chestDirectVolume * 0.5, 0);
    });
  });
});

describe('getEmptyStats', () => {
  it('should return zeroed stats object', () => {
    const stats = getEmptyStats();

    expect(stats.totalWorkoutDays).toBe(0);
    expect(stats.mostCommonExercise).toBe('');
    expect(stats.averageExercisesPerDay).toBe(0);
    expect(stats.averageSetsPerDay).toBe(0);
    expect(Object.keys(stats.muscleGroupStats)).toHaveLength(0);
    expect(stats.uncategorized).toBeDefined();
    expect(Object.keys(stats.uncategorized.weeklySets)).toHaveLength(0);
    expect(Object.keys(stats.uncategorized.weeklyExerciseCount)).toHaveLength(0);
  });
});
