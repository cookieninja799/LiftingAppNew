import { z } from 'zod';
import { calculateStatsFromSessions } from '@/utils/analytics/calculateStats';
import { computeVolumeForExercise, getWeekFromDate } from '@/utils/helpers';
import { calculatePRMetrics } from '@/utils/pr/calculatePRMetrics';
import { WorkoutExercise, WorkoutSession } from '@/utils/workoutSessions';
import {
  calculateE1RM,
  findBestMatch,
  normalizeExerciseName,
} from '../askUtils';

export type AskToolName =
  | 'resolve_exercise_name'
  | 'get_exercise_sessions'
  | 'get_exercise_progress'
  | 'get_last_session_summary'
  | 'get_prs'
  | 'get_pr'
  | 'get_volume_summary';

export interface AskToolContext {
  sessions: WorkoutSession[];
}

export interface AskToolDefinition<TArgs extends z.ZodTypeAny, TResult> {
  name: AskToolName;
  description: string;
  schema: TArgs;
  handler: (args: z.infer<TArgs>, ctx: AskToolContext) => TResult;
}

const resolveExerciseNameSchema = z.object({
  query: z.string().min(1),
});

const getExerciseSessionsSchema = z.object({
  exercise: z.string().min(1),
  limit: z.number().int().min(1).max(30).optional(),
  offset: z.number().int().min(0).optional(),
  includeSets: z.boolean().optional(),
  sort: z.enum(['asc', 'desc']).optional(),
});

const progressWindowSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('last_n'), n: z.number().int().min(1).max(30) }),
  z.object({ type: z.literal('days'), days: z.number().int().min(1).max(365) }),
  z.object({ type: z.literal('all') }),
]);

const getExerciseProgressSchema = z.object({
  exercise: z.string().min(1),
  window: progressWindowSchema.optional(),
});

const getLastSessionSummarySchema = z.object({});

const getPrsSchema = z.object({});

const getPrSchema = z.object({
  exercise: z.string().min(1),
});

const getVolumeSummarySchema = z.object({
  exercise: z.string().optional(),
  muscleGroup: z.string().optional(),
  start: z.string().optional(),
  end: z.string().optional(),
});

function parseWeightValue(weightText: string | undefined): number {
  if (!weightText) return 0;
  return parseFloat(weightText.replace(/[^\d.]/g, '')) || 0;
}

function summarizeExerciseSets(exercises: WorkoutExercise[]) {
  const sets = exercises.flatMap(ex => ex.sets.map(set => ({
    reps: set.reps,
    weightText: set.weightText,
  })));

  if (sets.length === 0) {
    return {
      sets,
      topSet: null,
      topWeight: 0,
      topReps: 0,
    };
  }

  let topSet = sets[0];
  let topWeight = parseWeightValue(topSet.weightText);
  let topReps = topSet.reps || 0;

  for (const set of sets) {
    const weight = parseWeightValue(set.weightText);
    const reps = set.reps || 0;
    if (weight > topWeight || (weight === topWeight && reps > topReps)) {
      topWeight = weight;
      topReps = reps;
      topSet = set;
    }
  }

  return {
    sets,
    topSet,
    topWeight,
    topReps,
  };
}

function getMatchingExerciseSessions(exerciseName: string, sessions: WorkoutSession[]) {
  const { match, suggestions } = findBestMatch(exerciseName, sessions);
  if (!match) {
    return { matchedExercise: null, suggestions, sessions: [] as WorkoutSession[] };
  }

  const normalizedMatch = normalizeExerciseName(match);
  const matchingSessions = sessions.filter(session =>
    session.exercises.some(ex => normalizeExerciseName(ex.nameRaw) === normalizedMatch)
  );

  return { matchedExercise: match, suggestions, sessions: matchingSessions };
}

export const askTools: AskToolDefinition<z.ZodTypeAny, any>[] = [
  {
    name: 'resolve_exercise_name',
    description: 'Resolve a user exercise name to the best match in their history.',
    schema: resolveExerciseNameSchema,
    handler: (args, ctx) => {
      const { match, suggestions } = findBestMatch(args.query, ctx.sessions);
      return {
        matchedExercise: match,
        suggestions,
      };
    },
  },
  {
    name: 'get_exercise_sessions',
    description: 'Get recent sessions for a specific exercise.',
    schema: getExerciseSessionsSchema,
    handler: (args, ctx) => {
      const limit = args.limit ?? 5;
      const offset = args.offset ?? 0;
      const sort = args.sort ?? 'desc';
      const includeSets = args.includeSets ?? false;

      const matchData = getMatchingExerciseSessions(args.exercise, ctx.sessions);
      if (!matchData.matchedExercise) {
        return {
          matchedExercise: null,
          sessions: [],
          suggestions: matchData.suggestions,
        };
      }

      const normalizedMatch = normalizeExerciseName(matchData.matchedExercise);
      const summaries = matchData.sessions.map(session => {
        const matchingExercises = session.exercises.filter(ex =>
          normalizeExerciseName(ex.nameRaw) === normalizedMatch
        );
        const { sets, topSet, topWeight, topReps } = summarizeExerciseSets(matchingExercises);
        const totalVolume = matchingExercises.reduce((sum, ex) => sum + computeVolumeForExercise(ex), 0);
        const setsCount = matchingExercises.reduce((sum, ex) => sum + ex.sets.length, 0);
        const e1rm = topWeight > 0 && topReps > 0 ? calculateE1RM(topWeight, topReps) : 0;

        return {
          date: session.performedOn,
          sessionId: session.id,
          setsCount,
          topSet: topSet ? { reps: topSet.reps, weightText: topSet.weightText } : null,
          topWeight,
          topReps,
          e1rm: Number.isFinite(e1rm) ? Number(e1rm.toFixed(1)) : 0,
          totalVolume: Number.isFinite(totalVolume) ? Number(totalVolume.toFixed(0)) : 0,
          exercisesCount: matchingExercises.length,
          sets: includeSets ? sets : undefined,
        };
      });

      const sorted = summaries.sort((a, b) => {
        const aTime = new Date(a.date).getTime();
        const bTime = new Date(b.date).getTime();
        return sort === 'asc' ? aTime - bTime : bTime - aTime;
      });

      return {
        matchedExercise: matchData.matchedExercise,
        sessions: sorted.slice(offset, offset + limit),
        suggestions: matchData.suggestions,
      };
    },
  },
  {
    name: 'get_exercise_progress',
    description: 'Calculate progress metrics for an exercise over a window.',
    schema: getExerciseProgressSchema,
    handler: (args, ctx) => {
      const window = args.window ?? { type: 'last_n', n: 5 };
      const matchData = getMatchingExerciseSessions(args.exercise, ctx.sessions);

      if (!matchData.matchedExercise) {
        return {
          matchedExercise: null,
          sessionCount: 0,
          sessions: [],
          suggestions: matchData.suggestions,
        };
      }

      const normalizedMatch = normalizeExerciseName(matchData.matchedExercise);
      const sessionSummaries = matchData.sessions.flatMap(session => {
        const matchingExercises = session.exercises.filter(ex =>
          normalizeExerciseName(ex.nameRaw) === normalizedMatch
        );
        if (matchingExercises.length === 0) return [];
        const { sets, topSet, topWeight, topReps } = summarizeExerciseSets(matchingExercises);
        const totalVolume = matchingExercises.reduce((sum, ex) => sum + computeVolumeForExercise(ex), 0);
        const e1rm = topWeight > 0 && topReps > 0 ? calculateE1RM(topWeight, topReps) : 0;

        return [{
          date: session.performedOn,
          sessionId: session.id,
          setsCount: matchingExercises.reduce((sum, ex) => sum + ex.sets.length, 0),
          topSet: topSet ? { reps: topSet.reps, weightText: topSet.weightText } : null,
          topWeight,
          topReps,
          e1rm: Number.isFinite(e1rm) ? Number(e1rm.toFixed(1)) : 0,
          totalVolume: Number.isFinite(totalVolume) ? Number(totalVolume.toFixed(0)) : 0,
          exercisesCount: matchingExercises.length,
          sets,
        }];
      });

      const sorted = sessionSummaries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      let relevantSessions = sorted;
      const now = new Date();

      if (window.type === 'days') {
        const start = new Date(now.getTime() - window.days * 24 * 60 * 60 * 1000);
        relevantSessions = sorted.filter(s => new Date(s.date) >= start);
      } else if (window.type === 'last_n') {
        relevantSessions = sorted.slice(-window.n);
      }

      const sessionCount = relevantSessions.length;
      if (sessionCount === 0) {
        return {
          matchedExercise: matchData.matchedExercise,
          sessionCount: 0,
          sessions: [],
          suggestions: matchData.suggestions,
          windowUsed: window,
        };
      }

      const first = relevantSessions[0];
      const last = relevantSessions[relevantSessions.length - 1];
      const weightChange = last.topWeight - first.topWeight;
      const weightChangePercent = first.topWeight > 0 ? (weightChange / first.topWeight) * 100 : 0;
      const e1rmChange = last.e1rm - first.e1rm;
      const e1rmChangePercent = first.e1rm > 0 ? (e1rmChange / first.e1rm) * 100 : 0;

      let trend: 'improving' | 'declining' | 'stable' = 'stable';
      if (e1rmChange > 0) trend = 'improving';
      if (e1rmChange < 0) trend = 'declining';

      return {
        matchedExercise: matchData.matchedExercise,
        windowUsed: window,
        sessionCount,
        first,
        last,
        weightChange: Number(weightChange.toFixed(1)),
        weightChangePercent: Number(weightChangePercent.toFixed(1)),
        e1rmChange: Number(e1rmChange.toFixed(1)),
        e1rmChangePercent: Number(e1rmChangePercent.toFixed(1)),
        trend,
        sessions: relevantSessions,
      };
    },
  },
  {
    name: 'get_last_session_summary',
    description: 'Get the most recent session summary.',
    schema: getLastSessionSummarySchema,
    handler: (_args, ctx) => {
      const sorted = [...ctx.sessions].sort(
        (a, b) => new Date(b.performedOn).getTime() - new Date(a.performedOn).getTime()
      );
      const lastSession = sorted[0];
      if (!lastSession) {
        return {
          sessionId: null,
          date: null,
          exercises: [],
        };
      }

      return {
        sessionId: lastSession.id,
        date: lastSession.performedOn,
        exercises: lastSession.exercises.map(ex => ({
          name: ex.nameRaw,
          sets: ex.sets.length,
          reps: ex.sets.map(s => s.reps),
          weights: ex.sets.map(s => s.weightText),
        })),
      };
    },
  },
  {
    name: 'get_prs',
    description: 'Get PRs for all exercises.',
    schema: getPrsSchema,
    handler: (_args, ctx) => {
      const prs = calculatePRMetrics(ctx.sessions).map(pr => ({
        exercise: pr.exercise,
        maxWeight: pr.maxWeight,
        reps: pr.reps,
        date: pr.date,
        estimated1RM: pr.estimated1RM,
        e1rmConfidence: pr.e1rmConfidence,
      }));

      return { prs };
    },
  },
  {
    name: 'get_pr',
    description: 'Get PR for a specific exercise.',
    schema: getPrSchema,
    handler: (args, ctx) => {
      const { match, suggestions } = findBestMatch(args.exercise, ctx.sessions);
      if (!match) {
        return {
          matchedExercise: null,
          pr: null,
          suggestions,
        };
      }

      const prs = calculatePRMetrics(ctx.sessions);
      const exerciseKey = normalizeExerciseName(match);
      const pr = prs.find(p => normalizeExerciseName(p.exercise) === exerciseKey);

      return {
        matchedExercise: match,
        pr: pr
          ? {
              exercise: pr.exercise,
              maxWeight: pr.maxWeight,
              reps: pr.reps,
              date: pr.date,
              estimated1RM: pr.estimated1RM,
              e1rmConfidence: pr.e1rmConfidence,
            }
          : null,
        suggestions,
      };
    },
  },
  {
    name: 'get_volume_summary',
    description: 'Summarize total sets for a time range, exercise, or muscle group.',
    schema: getVolumeSummarySchema,
    handler: (args, ctx) => {
      const now = new Date();
      let startDate: Date | null = null;
      let endDate: Date | null = null;

      if (args.start) startDate = new Date(args.start);
      if (args.end) endDate = new Date(args.end);

      const rangeLabel = startDate || endDate ? 'custom range' : 'recent history';
      const filtered = ctx.sessions.filter(session => {
        const sessionDate = new Date(session.performedOn);
        if (startDate && sessionDate < startDate) return false;
        if (endDate && sessionDate > endDate) return false;
        return true;
      });

      let totalSets = 0;
      let targetLabel = 'total';

      if (args.exercise) {
        const matchData = getMatchingExerciseSessions(args.exercise, filtered);
        if (!matchData.matchedExercise) {
          return {
            targetLabel: args.exercise,
            totalSets: 0,
            rangeLabel,
            suggestions: matchData.suggestions,
          };
        }
        targetLabel = matchData.matchedExercise;
        const normalizedMatch = normalizeExerciseName(matchData.matchedExercise);
        for (const session of matchData.sessions) {
          for (const ex of session.exercises) {
            if (normalizeExerciseName(ex.nameRaw) === normalizedMatch) {
              totalSets += ex.sets.length;
            }
          }
        }
      } else if (args.muscleGroup) {
        const stats = calculateStatsFromSessions(filtered, {
          currentWeek: getWeekFromDate(now.toISOString()),
        });
        const groupStats = stats.workoutStats.muscleGroupStats[args.muscleGroup];
        if (groupStats) {
          totalSets = Object.values(groupStats.weeklySets.direct).reduce((sum, sets) => sum + sets, 0);
        }
        targetLabel = args.muscleGroup;
      } else {
        for (const session of filtered) {
          totalSets += session.exercises.reduce((sum, ex) => sum + ex.sets.length, 0);
        }
      }

      return {
        targetLabel,
        totalSets,
        rangeLabel,
      };
    },
  },
];

export function getAskTool(name: AskToolName) {
  return askTools.find(tool => tool.name === name);
}
