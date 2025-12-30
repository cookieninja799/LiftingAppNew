// utils/pr/calculatePRMetrics.ts
// Extracted PR calculation logic from PRTab.tsx for testability

import { WorkoutSession } from '../workoutSessions';

export type E1RMConfidence = 'high' | 'medium' | 'low';

export interface PRMetric {
  exercise: string;
  maxWeight: number;
  reps: number;
  date: string;
  estimated1RM?: number;
  e1rmConfidence?: E1RMConfidence;
  e1rmConfidenceReasons?: string[];
}

export function calculateE1RM(weight: number, reps: number): number {
  // Epley: e1rm = weight * (1 + reps/30)
  return weight * (1 + reps / 30);
}

function toDate(value: string | Date | undefined): Date | undefined {
  if (!value) return undefined;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function daysBetween(earlier: Date, later: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((later.getTime() - earlier.getTime()) / msPerDay);
}

export function getE1RMConfidence(params: {
  reps: number;
  prDate: string | Date;
  referenceDate?: string | Date;
}): { confidence: E1RMConfidence; reasons: string[] } {
  const reasons: string[] = [];

  const reps = params.reps ?? 0;
  if (!Number.isFinite(reps) || reps <= 0) {
    reasons.push('missing/invalid reps');
  }

  const prDate = toDate(params.prDate);
  const referenceDate = toDate(params.referenceDate) ?? new Date();

  let dateDaysAgo: number | undefined;
  if (!prDate) {
    reasons.push('missing/invalid PR date');
  } else {
    dateDaysAgo = daysBetween(prDate, referenceDate);
    if (dateDaysAgo < 0) dateDaysAgo = 0; // future dates treated as "today"
  }

  const repsScore: E1RMConfidence =
    reps >= 1 && reps <= 5 ? 'high' : reps >= 6 && reps <= 10 ? 'medium' : 'low';

  const dateScore: E1RMConfidence =
    dateDaysAgo === undefined
      ? 'low'
      : dateDaysAgo < 30
        ? 'high'
        : dateDaysAgo <= 90
          ? 'medium'
          : 'low';

  if (repsScore !== 'high') {
    reasons.push(repsScore === 'medium' ? 'moderate reps (6–10)' : 'high reps (11+)');
  }
  if (dateScore !== 'high') {
    reasons.push(dateScore === 'medium' ? 'PR is 30–90 days old' : 'PR is >90 days old');
  }

  const rank = (c: E1RMConfidence) => (c === 'high' ? 3 : c === 'medium' ? 2 : 1);
  const confidenceRank = Math.min(rank(repsScore), rank(dateScore));
  const confidence: E1RMConfidence =
    confidenceRank === 3 ? 'high' : confidenceRank === 2 ? 'medium' : 'low';

  return { confidence, reasons };
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
export function calculatePRMetrics(
  sessions: WorkoutSession[],
  opts?: { referenceDate?: string | Date }
): PRMetric[] {
  const prMetrics: Record<string, PRMetric> = {};

  sessions.forEach(session => {
    session.exercises.forEach(ex => {
      ex.sets.forEach(set => {
        const weight = parseFloat(set.weightText.replace(/[^\d.]/g, "")) || 0;
        const reps = set.reps || 0;
        const key = ex.nameRaw.toLowerCase();

        // Update if:
        // 1. No record exists for this exercise
        // 2. The weight is higher than the current PR
        // 3. The weight is equal but the rep count is higher
        if (
          !prMetrics[key] ||
          weight > prMetrics[key].maxWeight ||
          (weight === prMetrics[key].maxWeight && reps > prMetrics[key].reps)
        ) {
          const estimated1RM = weight > 0 ? calculateE1RM(weight, reps) : undefined;
          const { confidence: e1rmConfidence, reasons: e1rmConfidenceReasons } =
            weight > 0
              ? getE1RMConfidence({
                  reps,
                  prDate: session.performedOn,
                  referenceDate: opts?.referenceDate,
                })
              : {
                  confidence: 'low' as const,
                  reasons: ['bodyweight/unparsed load'],
                };

          prMetrics[key] = {
            exercise: ex.nameRaw,
            maxWeight: weight,
            reps: reps,
            date: session.performedOn,
            estimated1RM,
            e1rmConfidence,
            e1rmConfidenceReasons,
          };
        }
      });
    });
  });

  return Object.values(prMetrics).sort((a, b) => a.exercise.localeCompare(b.exercise));
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
