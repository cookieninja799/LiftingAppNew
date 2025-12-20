// utils/analytics/calculateStats.ts
// Extracted analytics calculation logic from Analytics.tsx for testability

import { computeVolumeForExercise, getWeekFromDate } from '../helpers';
import { WorkoutSession } from '../workoutSessions';
import { ensureMuscleContributions } from './muscleContributions';

export interface WeeklySetsBreakdown {
  direct: Record<string, number>;
  fractional: Record<string, number>;
  touched: Record<string, number>;
}

export interface MuscleGroupStat {
  totalVolume: number;
  totalVolumeDirect: number;
  totalVolumeAllocated: number;
  averageVolume: number;
  averageVolumeDirect: number;
  averageVolumeAllocated: number;
  weeklySets: WeeklySetsBreakdown;
}

export interface UncategorizedStats {
  weeklySets: Record<string, number>;
  weeklyExerciseCount: Record<string, number>;
}

export interface WorkoutStats {
  totalWorkoutDays: number;
  mostCommonExercise: string;
  averageExercisesPerDay: number;
  averageSetsPerDay: number;
  muscleGroupStats: Record<string, MuscleGroupStat>;
  uncategorized: UncategorizedStats;
}

export interface CalculateStatsResult {
  workoutStats: WorkoutStats;
  markedDates: Record<string, number>;
}

/**
 * Calculates workout statistics from session data.
 * 
 * Supports fractional set counting:
 * - direct: Sets where fraction === 1 or isDirect === true
 * - fractional: Sets weighted by contribution fraction
 * - total: All sets regardless of fraction
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

  // Track weekly muscle group data with direct/fractional/touched breakdown
  const weeklyMuscleGroupStats: Record<
    string,
    Record<string, {
      totalVolume: number;
      totalVolumeDirect: number;
      totalVolumeAllocated: number;
      sessionCount: number;
      weeklySets: {
        direct: number;
        fractional: number;
        touched: number;
      };
    }>
  > = {};

  // Track uncategorized sets (exercises with no muscle contributions)
  const uncategorized: UncategorizedStats = {
    weeklySets: {},
    weeklyExerciseCount: {},
  };

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

    // Track which muscle groups we've seen in this session to count sessions per group correctly
    const seenGroupsInSession = new Set<string>();

    session.exercises.forEach(ex => {
      totalSets += ex.sets;
      totalExercises++;

      const key = ex.exercise.toLowerCase();
      exerciseFrequency[key] = (exerciseFrequency[key] || 0) + 1;

      // Get muscle contributions (from exercise data, templates, or primary muscle group)
      const contribs = ensureMuscleContributions(ex);
      
      if (!contribs || contribs.length === 0) {
        // No muscle contributions - track as uncategorized
        uncategorized.weeklySets[week] = (uncategorized.weeklySets[week] || 0) + ex.sets;
        uncategorized.weeklyExerciseCount[week] = (uncategorized.weeklyExerciseCount[week] || 0) + 1;
      } else {
        const exerciseVolume = computeVolumeForExercise(ex);
        
        // Process each muscle contribution
        contribs.forEach(contrib => {
          const muscleGroup = contrib.muscleGroup;
          
          if (!weeklyMuscleGroupStats[week][muscleGroup]) {
            weeklyMuscleGroupStats[week][muscleGroup] = {
              totalVolume: 0,
              totalVolumeDirect: 0,
              totalVolumeAllocated: 0,
              sessionCount: 0,
              weeklySets: {
                direct: 0,
                fractional: 0,
                touched: 0,
              },
            };
          }

          const stats = weeklyMuscleGroupStats[week][muscleGroup];
          
          // Calculate set contributions
          const fractionalSets = ex.sets * contrib.fraction;
          const isDirect = contrib.fraction === 1 || contrib.isDirect === true;
          const directSets = isDirect ? ex.sets : 0;
          
          stats.weeklySets.fractional += fractionalSets;
          stats.weeklySets.direct += directSets;
          stats.weeklySets.touched += ex.sets;
          
          // Track volume
          // totalVolume: legacy field, keep as allocated for backward compatibility
          stats.totalVolume += exerciseVolume * contrib.fraction;
          // totalVolumeDirect: direct-only tonnage (literature standard for volume)
          stats.totalVolumeDirect += isDirect ? exerciseVolume : 0;
          // totalVolumeAllocated: fraction-weighted tonnage (for secondary muscle work)
          stats.totalVolumeAllocated += exerciseVolume * contrib.fraction;
          
          // Increment session count only once per session per muscle group
          if (!seenGroupsInSession.has(muscleGroup)) {
            stats.sessionCount += 1;
            seenGroupsInSession.add(muscleGroup);
          }
        });
      }
    });
  });

  // Aggregate muscle group stats across weeks
  const muscleGroupStats: Record<string, MuscleGroupStat> = {};
  const totalSessionCounts: Record<string, number> = {};

  Object.keys(weeklyMuscleGroupStats).forEach(week => {
    Object.keys(weeklyMuscleGroupStats[week]).forEach(group => {
      if (!muscleGroupStats[group]) {
        muscleGroupStats[group] = { 
          totalVolume: 0,
          totalVolumeDirect: 0,
          totalVolumeAllocated: 0,
          averageVolume: 0,
          averageVolumeDirect: 0,
          averageVolumeAllocated: 0,
          weeklySets: {
            direct: {},
            fractional: {},
            touched: {},
          },
        };
      }
      if (!totalSessionCounts[group]) {
        totalSessionCounts[group] = 0;
      }

      const weekStats = weeklyMuscleGroupStats[week][group];

      muscleGroupStats[group].totalVolume += weekStats.totalVolume;
      muscleGroupStats[group].totalVolumeDirect += weekStats.totalVolumeDirect;
      muscleGroupStats[group].totalVolumeAllocated += weekStats.totalVolumeAllocated;
      muscleGroupStats[group].weeklySets.direct[week] = weekStats.weeklySets.direct;
      muscleGroupStats[group].weeklySets.fractional[week] = weekStats.weeklySets.fractional;
      muscleGroupStats[group].weeklySets.touched[week] = weekStats.weeklySets.touched;
      totalSessionCounts[group] += weekStats.sessionCount;
    });
  });

  // Compute average volume per session (overall average)
  Object.keys(muscleGroupStats).forEach(group => {
    const totalVolume = muscleGroupStats[group].totalVolume;
    const totalVolumeDirect = muscleGroupStats[group].totalVolumeDirect;
    const totalVolumeAllocated = muscleGroupStats[group].totalVolumeAllocated;
    const numSessions = totalSessionCounts[group];

    muscleGroupStats[group].averageVolume = numSessions > 0
      ? totalVolume / numSessions
      : 0;
    muscleGroupStats[group].averageVolumeDirect = numSessions > 0
      ? totalVolumeDirect / numSessions
      : 0;
    muscleGroupStats[group].averageVolumeAllocated = numSessions > 0
      ? totalVolumeAllocated / numSessions
      : 0;
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
    uncategorized,
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
    uncategorized: {
      weeklySets: {},
      weeklyExerciseCount: {},
    },
  };
}
