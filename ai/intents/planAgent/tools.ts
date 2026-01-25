import { z } from 'zod';
import { WorkoutExercise, WorkoutSession } from '@/utils/workoutSessions';
import { computeVolumeForExercise } from '@/utils/helpers';
import { calculateE1RM, findBestMatch, normalizeExerciseName } from '@/ai/intents/askUtils';
import { calculatePRMetrics } from '@/utils/pr/calculatePRMetrics';
import {
  calculateWeightForReps,
  estimateWeightFromSimilarExercise,
  isLowerBodyExercise,
  TrainingGoal,
} from '@/utils/pr/strengthCalculator';
import { PlanToolDefinition, PlanToolName } from './types';
import {
  EQUIPMENT_ALTERNATIVES,
  EXERCISE_STRENGTH_RATIOS,
  MOVEMENT_PATTERN_GROUPS,
} from './strengthRatios';
import { EXERCISE_ALTERNATIVES, getAllExerciseNames } from '@/ai/intents/askUtils';
import { classifyStrength, getNearestStandard, LiftName, Sex, AgeBand } from './standards';

function parseWeightValue(weightText: string | undefined): number {
  if (!weightText) return 0;
  return parseFloat(weightText.replace(/[^\d.]/g, '')) || 0;
}

function getMuscleGroups(exercise: WorkoutExercise): string[] {
  if (exercise.muscleContributions && exercise.muscleContributions.length > 0) {
    return exercise.muscleContributions.map((c) => c.muscleGroup);
  }
  return exercise.primaryMuscleGroup ? [exercise.primaryMuscleGroup] : [];
}

function getMatchingExerciseSessions(exerciseName: string, sessions: WorkoutSession[]) {
  const { match, suggestions } = findBestMatch(exerciseName, sessions);
  if (!match) {
    return { matchedExercise: null, suggestions, sessions: [] as WorkoutSession[] };
  }

  const normalizedMatch = normalizeExerciseName(match);
  const matchingSessions = sessions.filter((session) =>
    session.exercises.some((ex) => normalizeExerciseName(ex.nameRaw) === normalizedMatch)
  );

  return { matchedExercise: match, suggestions, sessions: matchingSessions };
}

const getRecentWorkoutsSchema = z.object({
  days: z.number().int().min(1).max(30).default(7),
  includeMuscleGroups: z.boolean().optional().default(true),
});

const getExerciseWorkingWeightsSchema = z.object({
  exercise: z.string().min(1),
  limit: z.number().int().min(1).max(10).optional(),
  daysBack: z.number().int().min(1).max(90).optional(),
});

const calculateRecommendedWeightSchema = z.object({
  exercise: z.string().min(1),
  targetReps: z.number().int().min(1).max(30),
  goal: z.enum(['strength', 'hypertrophy', 'conditioning']),
  progressionStyle: z.enum(['aggressive', 'gradual', 'maintenance', 'deload']),
});

const checkMuscleRecoverySchema = z.object({
  muscleGroup: z.string().min(1),
});

const estimateWeightFromSimilarSchema = z.object({
  targetExercise: z.string().min(1),
  targetReps: z.number().int().min(1).max(30),
  goal: z.enum(['strength', 'hypertrophy', 'conditioning']),
});

const getExerciseAlternativeSchema = z.object({
  exercise: z.string().min(1),
  reason: z.enum(['equipment', 'injury', 'variety']).optional(),
  availableEquipment: z.array(z.string()).optional(),
});

const findSimilarExercisesByPatternSchema = z.object({
  movementPattern: z.string().min(1),
});

const getStrengthStandardSchema = z.object({
  lift: z.enum(['squat', 'bench', 'deadlift', 'press']),
  weight: z.number().nonnegative(),
  reps: z.number().int().min(1),
  bodyweightKg: z.number().positive(),
  ageBand: z.enum(['15-19', '20-29', '30-39', '40-49', '50-59', '60-69', '70-79', '80-89']),
  sex: z.enum(['male', 'female']),
});

const getStandardsAdjustmentSchema = z.object({
  lift: z.enum(['squat', 'bench', 'deadlift', 'press']),
  targetReps: z.number().int().min(1).max(30),
  bodyweightKg: z.number().positive(),
  ageBand: z.enum(['15-19', '20-29', '30-39', '40-49', '50-59', '60-69', '70-79', '80-89']),
  sex: z.enum(['male', 'female']),
});

export const planTools: PlanToolDefinition<z.ZodTypeAny, any>[] = [
  {
    name: 'get_recent_workouts',
    description: 'Get recent workouts from the last N days.',
    schema: getRecentWorkoutsSchema,
    handler: (args, ctx) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const cutoff = new Date(today);
      cutoff.setDate(cutoff.getDate() - args.days);

      const workouts = ctx.sessions
        .filter((session) => {
          // Parse session date and normalize to midnight for comparison
          const sessionDate = new Date(session.performedOn + 'T00:00:00');
          sessionDate.setHours(0, 0, 0, 0);
          return sessionDate >= cutoff;
        })
        .map((session) => {
          const exercises = session.exercises.map((ex) => ex.nameRaw);
          const muscleGroups = args.includeMuscleGroups
            ? Array.from(
                new Set(session.exercises.flatMap((ex) => getMuscleGroups(ex)).filter(Boolean))
              )
            : undefined;
          return {
            date: session.performedOn,
            sessionId: session.id,
            exercises,
            muscleGroups,
          };
        })
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      return {
        sessionCount: workouts.length,
        workouts,
      };
    },
  },
  {
    name: 'get_exercise_working_weights',
    description: 'Get recent working weights for a specific exercise.',
    schema: getExerciseWorkingWeightsSchema,
    handler: (args, ctx) => {
      const limit = args.limit ?? 5;
      const matchData = getMatchingExerciseSessions(args.exercise, ctx.sessions);
      if (!matchData.matchedExercise) {
        return {
          matchedExercise: null,
          suggestions: matchData.suggestions,
          history: [],
        };
      }

      let sessions = matchData.sessions;
      if (args.daysBack) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - args.daysBack);
        sessions = sessions.filter((session) => new Date(session.performedOn) >= cutoff);
      }

      const normalizedMatch = normalizeExerciseName(matchData.matchedExercise);
      const history = sessions
        .map((session) => {
          const matchingExercises = session.exercises.filter(
            (ex) => normalizeExerciseName(ex.nameRaw) === normalizedMatch
          );
          if (matchingExercises.length === 0) return null;

          const sets = matchingExercises.flatMap((ex) =>
            ex.sets.map((set) => ({
              reps: set.reps,
              weight: parseWeightValue(set.weightText),
              weightText: set.weightText,
            }))
          );
          if (sets.length === 0) return null;

          const topSet = sets.reduce((best, current) => {
            if (current.weight > best.weight) return current;
            if (current.weight === best.weight && current.reps > best.reps) return current;
            return best;
          }, sets[0]);

          const totalVolume = matchingExercises.reduce(
            (sum, ex) => sum + computeVolumeForExercise(ex),
            0
          );

          return {
            date: session.performedOn,
            sessionId: session.id,
            setsCount: matchingExercises.reduce((sum, ex) => sum + ex.sets.length, 0),
            topWeight: topSet.weight,
            topReps: topSet.reps,
            e1rm: Number.isFinite(calculateE1RM(topSet.weight, topSet.reps))
              ? Number(calculateE1RM(topSet.weight, topSet.reps).toFixed(1))
              : 0,
            totalVolume: Number.isFinite(totalVolume) ? Number(totalVolume.toFixed(0)) : 0,
            sets,
          };
        })
        .filter(Boolean)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, limit);

      return {
        matchedExercise: matchData.matchedExercise,
        suggestions: matchData.suggestions,
        history,
      };
    },
  },
  {
    name: 'calculate_recommended_weight',
    description: 'Calculate a recommended working weight for an exercise.',
    schema: calculateRecommendedWeightSchema,
    handler: (args, ctx) => {
      const historyResult = planTools.find(
        (tool) => tool.name === 'get_exercise_working_weights'
      );
      if (!historyResult) {
        return { success: false, reason: 'tool_unavailable' };
      }

      const historyData = historyResult.handler(
        { exercise: args.exercise, limit: 5, daysBack: 45 },
        ctx
      );

      if (!historyData.matchedExercise || historyData.history.length === 0) {
        return {
          success: false,
          reason: 'no_history',
          suggestions: historyData.suggestions,
        };
      }

      const latest = historyData.history[0];
      const baseWeight = latest.topWeight;
      const baseReps = latest.topReps;
      const latestDate = latest.date;

      let recommendedWeight = baseWeight;
      if (args.progressionStyle === 'deload') {
        recommendedWeight = Math.round((baseWeight * 0.8) / 2.5) * 2.5;
      } else if (args.progressionStyle === 'maintenance') {
        recommendedWeight = baseWeight;
      } else {
        const increment = isLowerBodyExercise(args.exercise)
          ? args.progressionStyle === 'aggressive'
            ? 10
            : 5
          : args.progressionStyle === 'aggressive'
            ? 5
            : 2.5;
        recommendedWeight = baseWeight + increment;
      }

      if (Math.abs(baseReps - args.targetReps) > 3) {
        const estimated1RM = calculateE1RM(baseWeight, baseReps);
        recommendedWeight = calculateWeightForReps({
          estimated1RM,
          targetReps: args.targetReps,
          goal: args.goal as TrainingGoal,
        });
      }

      const daysSinceLastSession = Math.floor(
        (Date.now() - new Date(latestDate).getTime()) / (1000 * 60 * 60 * 24)
      );
      let confidence: 'high' | 'medium' | 'low' = 'high';
      if (daysSinceLastSession > 21) {
        confidence = 'low';
      } else if (daysSinceLastSession > 14) {
        confidence = 'medium';
      } else if (historyData.history.length < 2) {
        confidence = 'medium';
      }

      return {
        success: true,
        recommendedWeight,
        unit: 'lbs',
        confidence,
        reasoning: {
          basedOnWeight: baseWeight,
          basedOnReps: baseReps,
          basedOnDate: latestDate,
          progressionApplied: args.progressionStyle,
          daysSinceLastSession,
        },
        fallbackRange: {
          min: Math.max(0, recommendedWeight - 5),
          max: recommendedWeight + 5,
        },
      };
    },
  },
  {
    name: 'check_muscle_recovery',
    description: 'Check how recently a muscle group was trained.',
    schema: checkMuscleRecoverySchema,
    handler: (args, ctx) => {
      const target = args.muscleGroup.toLowerCase().trim();
      const sorted = [...ctx.sessions].sort(
        (a, b) => new Date(b.performedOn).getTime() - new Date(a.performedOn).getTime()
      );

      let lastDate: string | null = null;
      for (const session of sorted) {
        for (const ex of session.exercises) {
          const groups = getMuscleGroups(ex).map((g) => g.toLowerCase());
          if (groups.includes(target)) {
            lastDate = session.performedOn;
            break;
          }
        }
        if (lastDate) break;
      }

      if (!lastDate) {
        return {
          muscleGroup: args.muscleGroup,
          lastTrainedDate: null,
          daysSince: null,
          recoveryStatus: 'unknown',
        };
      }

      const daysSince = Math.floor(
        (Date.now() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24)
      );
      let recoveryStatus: 'needs_rest' | 'partial' | 'recovered' = 'recovered';
      if (daysSince <= 2) {
        recoveryStatus = 'needs_rest';
      } else if (daysSince <= 5) {
        recoveryStatus = 'partial';
      }

      return {
        muscleGroup: args.muscleGroup,
        lastTrainedDate: lastDate,
        daysSince,
        recoveryStatus,
      };
    },
  },
  {
    name: 'estimate_weight_from_similar',
    description: 'Estimate weights for a new exercise based on similar exercise PRs.',
    schema: estimateWeightFromSimilarSchema,
    handler: (args, ctx) => {
      const ratios = EXERCISE_STRENGTH_RATIOS[args.targetExercise] || {};
      const prMetrics = calculatePRMetrics(ctx.sessions);

      for (const [similarExercise, ratio] of Object.entries(ratios)) {
        const match = prMetrics.find(
          (pr) =>
            normalizeExerciseName(pr.exercise) ===
            normalizeExerciseName(similarExercise)
        );
        if (!match) continue;

        const similar1RM = calculateE1RM(match.maxWeight, match.reps);
        const { estimated1RM, recommendedWeight } = estimateWeightFromSimilarExercise({
          similarExercise1RM: similar1RM,
          strengthRatio: ratio,
          targetReps: args.targetReps,
          goal: args.goal as TrainingGoal,
        });

        // Use first variation (original name) to preserve capitalization, fallback to exercise name
        const displayName = match.variations && match.variations.length > 0 
          ? match.variations[0] 
          : match.exercise;
        
        return {
          success: true,
          targetExercise: args.targetExercise,
          basedOnExercise: displayName,
          ratioUsed: ratio,
          estimated1RM: Number.isFinite(estimated1RM) ? Number(estimated1RM.toFixed(1)) : 0,
          recommendedWeight,
          unit: 'lbs',
          confidence: 'medium',
          reasoning: `Estimated from ${displayName} (${match.maxWeight} × ${match.reps})`,
        };
      }

      return {
        success: false,
        reason: 'no_similar_history',
        targetExercise: args.targetExercise,
        suggestions: Object.keys(ratios),
      };
    },
  },
  {
    name: 'get_exercise_alternative',
    description: 'Suggest alternative exercises based on equipment or variety.',
    schema: getExerciseAlternativeSchema,
    handler: (args, ctx) => {
      const normalized = normalizeExerciseName(args.exercise);
      const allUserExercises = getAllExerciseNames(ctx.sessions);

      const equipmentAlternatives = Object.entries(EQUIPMENT_ALTERNATIVES).find(
        ([exercise]) => normalizeExerciseName(exercise) === normalized
      )?.[1];

      const generalAlternatives = Object.entries(EXERCISE_ALTERNATIVES).find(
        ([exercise]) => normalizeExerciseName(exercise) === normalized
      )?.[1];

      const alternatives = Array.from(
        new Set([...(equipmentAlternatives || []), ...(generalAlternatives || [])])
      );

      const alternativesUserHasDone = alternatives.filter((alt) =>
        allUserExercises.some(
          (userEx) => normalizeExerciseName(userEx) === normalizeExerciseName(alt)
        )
      );

      return {
        exercise: args.exercise,
        alternatives,
        alternativesUserHasDone,
        reason: args.reason ?? null,
      };
    },
  },
  {
    name: 'find_similar_exercises_by_pattern',
    description: 'Find user exercises that match a movement pattern.',
    schema: findSimilarExercisesByPatternSchema,
    handler: (args, ctx) => {
      const pattern = args.movementPattern;
      const patternExercises = MOVEMENT_PATTERN_GROUPS[pattern] || [];
      const userExercises = getAllExerciseNames(ctx.sessions);

      const matches = patternExercises.filter((patternEx) =>
        userExercises.some(
          (userEx) =>
            normalizeExerciseName(userEx) === normalizeExerciseName(patternEx)
        )
      );

      return {
        movementPattern: pattern,
        matches,
        suggestions: patternExercises,
      };
    },
  },
  {
    name: 'get_strength_standard',
    description: 'Classify a lift against Kilgore standards for advisory guidance.',
    schema: getStrengthStandardSchema,
    handler: (args) => {
      const standard = getNearestStandard({
        sex: args.sex as Sex,
        ageBand: args.ageBand as AgeBand,
        bodyweightKg: args.bodyweightKg,
        lift: args.lift as LiftName,
      });
      if (!standard) {
        return { success: false, reason: 'no_standard', lift: args.lift };
      }

      const estimated1RM = calculateE1RM(args.weight, args.reps);
      const { classification, percentOfElite } = classifyStrength({ estimated1RM, standard });

      return {
        success: true,
        lift: args.lift,
        classification,
        percentOfElite: Number(percentOfElite.toFixed(2)),
        estimated1RM: Number(estimated1RM.toFixed(1)),
        standard,
        advisoryNotes: `Estimated 1RM falls in ${classification} range for your profile.`,
      };
    },
  },
  {
    name: 'get_standards_adjustment',
    description: 'Provide a recommended intensity range based on Kilgore standards.',
    schema: getStandardsAdjustmentSchema,
    handler: (args) => {
      const standard = getNearestStandard({
        sex: args.sex as Sex,
        ageBand: args.ageBand as AgeBand,
        bodyweightKg: args.bodyweightKg,
        lift: args.lift as LiftName,
      });
      if (!standard) {
        return { success: false, reason: 'no_standard', lift: args.lift };
      }

      const target1RM = standard.levels.intermediate;
      const targetWeight = calculateWeightForReps({
        estimated1RM: target1RM,
        targetReps: args.targetReps,
        goal: 'hypertrophy',
      });

      return {
        success: true,
        lift: args.lift,
        targetClassificationBand: 'intermediate',
        suggestedRangeKg: {
          min: Math.max(0, targetWeight * 0.9),
          max: targetWeight * 1.1,
        },
      };
    },
  },
];

export function getPlanTool(name: PlanToolName) {
  return planTools.find((tool) => tool.name === name);
}
