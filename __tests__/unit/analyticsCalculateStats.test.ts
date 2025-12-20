// __tests__/unit/analyticsCalculateStats.test.ts
import {
    calculateStatsFromSessions,
    getEmptyStats
} from '../../utils/analytics/calculateStats';
import {
    emptySessions,
    getTestCurrentWeek,
    multipleSessions,
    multiWeekSessions,
    sessionsWithMissingMuscleGroup,
    singleSession,
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
      const { workoutStats } = calculateStatsFromSessions(
        [
          {
            id: 'session-1',
            date: '2024-12-18',
            exercises: [
              {
                id: 'ex-1',
                exercise: 'Deadlift',
                sets: 5,
                reps: [5, 5, 5, 5, 5],
                weights: ['315', '315', '315', '315', '315'],
                primaryMuscleGroup: 'Back',
              },
            ],
          },
        ],
        { currentWeek }
      );

      expect(workoutStats.mostCommonExercise).toBe('deadlift');
    });
  });

  describe('muscleGroupStats', () => {
    it('should calculate weekly sets for muscle groups', () => {
      const { workoutStats } = calculateStatsFromSessions(multiWeekSessions, {
        currentWeek: '2024-W51',
      });

      // Week 51 has Chest exercises: 4 sets + 3 sets = 7 sets
      expect(workoutStats.muscleGroupStats['Chest']).toBeDefined();
      expect(workoutStats.muscleGroupStats['Chest'].weeklySets['2024-W51']).toBe(7);
    });

    it('should track sets from different weeks separately', () => {
      const { workoutStats } = calculateStatsFromSessions(multiWeekSessions, {
        currentWeek: '2024-W51',
      });

      // Week 50 has Chest: 3 sets
      expect(workoutStats.muscleGroupStats['Chest'].weeklySets['2024-W50']).toBe(3);
      // Week 49 has Quads: 5 sets
      expect(workoutStats.muscleGroupStats['Quads'].weeklySets['2024-W49']).toBe(5);
    });

    it('should handle missing muscle groups gracefully', () => {
      const { workoutStats } = calculateStatsFromSessions(
        sessionsWithMissingMuscleGroup,
        { currentWeek }
      );

      // Should create an "Unknown" muscle group entry
      expect(workoutStats.muscleGroupStats['Unknown']).toBeDefined();
      expect(workoutStats.muscleGroupStats['Chest']).toBeDefined();
    });

    it('should calculate average volume for current week', () => {
      const { workoutStats } = calculateStatsFromSessions(multiWeekSessions, {
        currentWeek: '2024-W51',
      });

      // Chest has 2 exercises (sessions) in week 51
      expect(workoutStats.muscleGroupStats['Chest'].averageVolume).toBeGreaterThan(0);
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
  });
});
