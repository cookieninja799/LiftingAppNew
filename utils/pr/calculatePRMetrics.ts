// utils/pr/calculatePRMetrics.ts
// Extracted PR calculation logic from PRTab.tsx for testability

import { WorkoutSession } from '../workoutSessions';

export interface PRMetric {
  exercise: string;
  maxWeight: number;
  reps: number;
  date: string;
}

/**
 * Calculates personal records (PRs) for each exercise across all sessions.
 * 
 * PR Selection Rules:
 * 1. Highest weight wins
 * 2. Tie-break: If weights are equal, higher rep count wins
 * 
 * The function examines each set's weight and rep combination to determine
 * the best performance for each exercise.
 * 
 * @param sessions - Array of workout sessions to analyze
 * @returns Array of PRMetric objects, one for each unique exercise
 */
export function calculatePRMetrics(sessions: WorkoutSession[]): PRMetric[] {
  const prMetrics: Record<string, PRMetric> = {};

  sessions.forEach(session => {
    session.exercises.forEach(ex => {
      ex.weights.forEach((weightStr, i) => {
        const weight = parseFloat(weightStr) || 0;
        const reps = ex.reps[i] || 0;
        const key = ex.exercise.toLowerCase();

        // Update if:
        // 1. No record exists for this exercise
        // 2. The weight is higher than the current PR
        // 3. The weight is equal but the rep count is higher
        if (
          !prMetrics[key] ||
          weight > prMetrics[key].maxWeight ||
          (weight === prMetrics[key].maxWeight && reps > prMetrics[key].reps)
        ) {
          prMetrics[key] = {
            exercise: ex.exercise,
            maxWeight: weight,
            reps: reps,
            date: session.date,
          };
        }
      });
    });
  });

  return Object.values(prMetrics);
}

/**
 * Filters PR metrics by exercise name (case-insensitive)
 * 
 * @param prMetrics - Array of PR metrics to filter
 * @param searchQuery - Search string to match against exercise names
 * @returns Filtered array of PR metrics
 */
export function filterPRMetricsBySearch(prMetrics: PRMetric[], searchQuery: string): PRMetric[] {
  if (!searchQuery.trim()) {
    return prMetrics;
  }
  
  const normalizedQuery = searchQuery.toLowerCase();
  return prMetrics.filter(metric =>
    metric.exercise.toLowerCase().includes(normalizedQuery)
  );
}

/**
 * Sorts PR metrics by max weight in descending order
 */
export function sortPRMetricsByWeight(prMetrics: PRMetric[]): PRMetric[] {
  return [...prMetrics].sort((a, b) => b.maxWeight - a.maxWeight);
}

/**
 * Gets the top N PRs by weight
 */
export function getTopPRs(prMetrics: PRMetric[], count: number): PRMetric[] {
  return sortPRMetricsByWeight(prMetrics).slice(0, count);
}
