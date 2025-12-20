// utils/analytics/calculateStats.ts
// Extracted analytics calculation logic from Analytics.tsx for testability

import { computeVolumeForExercise, getWeekFromDate } from '../helpers';
import { WorkoutSession } from '../workoutSessions';

export interface MuscleGroupStat {
  totalVolume: number;
  averageVolume: number;
  weeklySets: Record<string, number>;
}

export interface WorkoutStats {
  totalWorkoutDays: number;
  mostCommonExercise: string;
  averageExercisesPerDay: number;
  averageSetsPerDay: number;
  muscleGroupStats: Record<string, MuscleGroupStat>;
}

export interface CalculateStatsResult {
  workoutStats: WorkoutStats;
  markedDates: Record<string, number>;
}

/**
 * Calculates workout statistics from session data.
 * 
 * @param sessions - Array of workout sessions to analyze
 * @param options - Configuration options
 * @param options.currentWeek - The current week identifier (e.g., "2024-W51") for weekly calculations
 * @returns Object containing workoutStats and markedDates (sets per day for heatmap)
 */
export function calculateStatsFromSessions(
  sessions: WorkoutSession[],
  options: {
    currentWeek: string;
  }
): CalculateStatsResult {
  const { currentWeek } = options;

  // Initialize result structures
  const dateTotalSets: Record<string, number> = {};
  const exerciseFrequency: Record<string, number> = {};
  
  let totalExercises = 0;
  let totalSets = 0;
  let totalWeeklySets = 0;

  // Track weekly muscle group data
  const weeklyMuscleGroupStats: Record<
    string,
    Record<string, {
      totalSets: number;
      totalVolume: number;
      sessionCount: number;
      weeklySets: Record<string, number>;
    }>
  > = {};

  // Process each session
  sessions.forEach(session => {
    let dailyTotalSets = 0;

    session.exercises.forEach(ex => {
      dailyTotalSets += ex.sets;
    });

    // Store total sets per day for heatmap
    dateTotalSets[session.date] = dailyTotalSets;
    
    const week = getWeekFromDate(session.date);
    
    if (!weeklyMuscleGroupStats[week]) {
      weeklyMuscleGroupStats[week] = {};
    }

    session.exercises.forEach(ex => {
      totalSets += ex.sets;
      totalExercises++;

      const key = ex.exercise.toLowerCase();
      exerciseFrequency[key] = (exerciseFrequency[key] || 0) + 1;

      const muscleGroup = ex.primaryMuscleGroup || 'Unknown';
      
      if (!weeklyMuscleGroupStats[week][muscleGroup]) {
        weeklyMuscleGroupStats[week][muscleGroup] = {
          totalSets: 0,
          totalVolume: 0,
          sessionCount: 0,
          weeklySets: {},
        };
      }

      const exerciseVolume = computeVolumeForExercise(ex);

      weeklyMuscleGroupStats[week][muscleGroup].totalSets += ex.sets;
      weeklyMuscleGroupStats[week][muscleGroup].totalVolume += exerciseVolume;
      weeklyMuscleGroupStats[week][muscleGroup].sessionCount += 1;
      weeklyMuscleGroupStats[week][muscleGroup].weeklySets[week] =
        (weeklyMuscleGroupStats[week][muscleGroup].weeklySets[week] || 0) + ex.sets;

      // Track current week's total sets
      if (week === currentWeek) {
        totalWeeklySets += ex.sets;
      }
    });
  });

  // Aggregate muscle group stats
  const muscleGroupStats: Record<string, MuscleGroupStat> = {};
  const weeklySessionCounts: Record<string, Record<string, number>> = {};

  Object.keys(weeklyMuscleGroupStats).forEach(week => {
    Object.keys(weeklyMuscleGroupStats[week]).forEach(group => {
      if (!muscleGroupStats[group]) {
        muscleGroupStats[group] = { totalVolume: 0, averageVolume: 0, weeklySets: {} };
      }
      if (!weeklySessionCounts[week]) {
        weeklySessionCounts[week] = {};
      }
      if (!weeklySessionCounts[week][group]) {
        weeklySessionCounts[week][group] = 0;
      }

      const totalVolume = weeklyMuscleGroupStats[week][group].totalVolume;
      const sessionCount = weeklyMuscleGroupStats[week][group].sessionCount;

      muscleGroupStats[group].totalVolume += totalVolume;
      muscleGroupStats[group].weeklySets[week] = weeklyMuscleGroupStats[week][group].weeklySets[week];
      weeklySessionCounts[week][group] += sessionCount;
    });
  });

  // Compute average volume per session for the current week only
  Object.keys(weeklySessionCounts).forEach(week => {
    if (week === currentWeek) {
      Object.keys(weeklySessionCounts[week]).forEach(group => {
        if (muscleGroupStats[group]?.weeklySets[week]) {
          const totalVolume = weeklyMuscleGroupStats[week][group].totalVolume;
          const numSessions = weeklySessionCounts[week][group];

          muscleGroupStats[group].averageVolume = numSessions > 0
            ? totalVolume / numSessions
            : 0;
        }
      });
    }
  });

  // Find most common exercise
  const mostCommonExercise = Object.keys(exerciseFrequency).length > 0
    ? Object.keys(exerciseFrequency).reduce((a, b) =>
        exerciseFrequency[a] > exerciseFrequency[b] ? a : b)
    : 'N/A';

  const totalWorkoutDays = sessions.length;

  const workoutStats: WorkoutStats = {
    totalWorkoutDays,
    mostCommonExercise,
    averageExercisesPerDay: totalWorkoutDays ? totalExercises / totalWorkoutDays : 0,
    averageSetsPerDay: totalWorkoutDays ? totalSets / totalWorkoutDays : 0,
    muscleGroupStats,
  };

  return {
    workoutStats,
    markedDates: dateTotalSets,
  };
}

/**
 * Returns empty/default stats for when there are no sessions
 */
export function getEmptyStats(): WorkoutStats {
  return {
    totalWorkoutDays: 0,
    mostCommonExercise: '',
    averageExercisesPerDay: 0,
    averageSetsPerDay: 0,
    muscleGroupStats: {},
  };
}
