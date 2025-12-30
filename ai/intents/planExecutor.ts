// ai/intents/planExecutor.ts
// Deterministic planner executor for Plan mode intents

import { WorkoutSession, WorkoutExercise } from '@/utils/workoutSessions';
import { PlanIntent } from './planSchema';
import { ensureMuscleContributions } from '@/utils/analytics/muscleContributions';
import { calculatePRMetrics, PRMetric } from '@/utils/pr/calculatePRMetrics';

export interface ExercisePlan {
  exercise: string;
  sets: number;
  reps: string; // "3–6" or "8–12"
  intensity?: string; // "RPE 7–8" or "%1RM"
  notes?: string;
  // New: Personalized weight recommendations
  recommendedWeight?: {
    value: number;
    unit: string;
    basedOn: 'pr' | 'recent' | 'estimate';
    confidence: 'high' | 'medium' | 'low';
    prWeight?: number; // The PR weight this is based on
    percentageOfMax?: number; // e.g., 70 for 70%
  };
}

export interface WorkoutPlan {
  title: string;
  rationale: string[];
  exercises: ExercisePlan[];
  basedOnData?: {
    lastLowerDay?: string;
    lastUpperDay?: string;
    lastPushDay?: string;
    lastPullDay?: string;
    exercisesAvoided?: string[];
    prData?: Array<{ exercise: string; maxWeight: number; reps: number; date: string }>;
  };
  isGeneric?: boolean;
  hasPersonalizedWeights?: boolean;
}

/**
 * Normalizes exercise name for matching
 */
function normalizeExerciseName(name: string): string {
  return name.toLowerCase().replace(/[^\w\s]/g, '').trim();
}

/**
 * Gets muscle groups for an exercise
 */
function getMuscleGroups(exercise: WorkoutExercise): string[] {
  const contribs = ensureMuscleContributions(exercise);
  if (!contribs || contribs.length === 0) {
    return exercise.primaryMuscleGroup ? [exercise.primaryMuscleGroup] : [];
  }
  return contribs.map(c => c.muscleGroup);
}

/**
 * Checks if exercise was trained recently (within hours)
 */
function wasTrainedRecently(
  exerciseName: string,
  sessions: WorkoutSession[],
  hoursThreshold: number = 48
): { trained: boolean; lastDate?: string } {
  const normalized = normalizeExerciseName(exerciseName);
  const thresholdMs = hoursThreshold * 60 * 60 * 1000;
  const now = Date.now();

  for (const session of sessions) {
    const sessionTime = new Date(session.performedOn).getTime();
    const hoursAgo = (now - sessionTime) / (60 * 60 * 1000);

    if (hoursAgo <= hoursThreshold) {
      // Check if this exercise was in this session
      for (const ex of session.exercises) {
        if (normalizeExerciseName(ex.nameRaw) === normalized) {
          return { trained: true, lastDate: session.performedOn };
        }
      }
    }
  }

  return { trained: false };
}

/**
 * Finds last training day for a muscle group pattern
 */
function findLastTrainingDay(
  muscleGroups: string[],
  sessions: WorkoutSession[]
): string | null {
  const sortedSessions = [...sessions].sort(
    (a, b) => new Date(b.performedOn).getTime() - new Date(a.performedOn).getTime()
  );

  for (const session of sortedSessions) {
    for (const ex of session.exercises) {
      const exGroups = getMuscleGroups(ex);
      if (muscleGroups.some(group => exGroups.includes(group))) {
        return session.performedOn;
      }
    }
  }

  return null;
}

/**
 * Common exercise templates by focus
 */
const EXERCISE_TEMPLATES: Record<string, Array<{ name: string; muscleGroups: string[] }>> = {
  upper: [
    { name: 'Bench Press', muscleGroups: ['Chest'] },
    { name: 'Overhead Press', muscleGroups: ['Shoulders'] },
    { name: 'Barbell Row', muscleGroups: ['Back'] },
    { name: 'Pull Up', muscleGroups: ['Back'] },
    { name: 'Bicep Curl', muscleGroups: ['Arms'] },
  ],
  lower: [
    { name: 'Squat', muscleGroups: ['Quads'] },
    { name: 'Romanian Deadlift', muscleGroups: ['Hamstrings'] },
    { name: 'Leg Press', muscleGroups: ['Quads'] },
    { name: 'Leg Curl', muscleGroups: ['Hamstrings'] },
    { name: 'Calf Raise', muscleGroups: [] },
  ],
  push: [
    { name: 'Bench Press', muscleGroups: ['Chest'] },
    { name: 'Overhead Press', muscleGroups: ['Shoulders'] },
    { name: 'Tricep Pushdown', muscleGroups: ['Arms'] },
    { name: 'Lateral Raise', muscleGroups: ['Shoulders'] },
  ],
  pull: [
    { name: 'Barbell Row', muscleGroups: ['Back'] },
    { name: 'Pull Up', muscleGroups: ['Back'] },
    { name: 'Lat Pulldown', muscleGroups: ['Back'] },
    { name: 'Bicep Curl', muscleGroups: ['Arms'] },
  ],
  legs: [
    { name: 'Squat', muscleGroups: ['Quads'] },
    { name: 'Romanian Deadlift', muscleGroups: ['Hamstrings'] },
    { name: 'Leg Press', muscleGroups: ['Quads'] },
    { name: 'Leg Curl', muscleGroups: ['Hamstrings'] },
    { name: 'Calf Raise', muscleGroups: [] },
  ],
  full: [
    { name: 'Squat', muscleGroups: ['Quads'] },
    { name: 'Bench Press', muscleGroups: ['Chest'] },
    { name: 'Barbell Row', muscleGroups: ['Back'] },
    { name: 'Overhead Press', muscleGroups: ['Shoulders'] },
    { name: 'Deadlift', muscleGroups: ['Hamstrings', 'Back'] },
  ],
};

/**
 * Exercise name aliases for PR matching
 */
const EXERCISE_PR_ALIASES: Record<string, string[]> = {
  'bench press': ['barbell bench press', 'flat bench', 'bb bench'],
  'squat': ['back squat', 'barbell squat', 'bb squat'],
  'deadlift': ['conventional deadlift', 'bb deadlift'],
  'overhead press': ['ohp', 'shoulder press', 'military press', 'standing press'],
  'barbell row': ['bent over row', 'bb row', 'bent row'],
  'romanian deadlift': ['rdl', 'stiff leg deadlift'],
  'lat pulldown': ['pulldown', 'cable pulldown'],
  'leg press': ['45 degree leg press', 'seated leg press'],
  'bicep curl': ['barbell curl', 'db curl', 'dumbbell curl', 'curls'],
  'tricep pushdown': ['cable pushdown', 'rope pushdown', 'tricep extension'],
  'lateral raise': ['side raise', 'db lateral raise'],
};

/**
 * Percentage of max for different training goals
 */
const GOAL_PERCENTAGES: Record<string, { min: number; max: number; target: number }> = {
  strength: { min: 80, max: 90, target: 85 },
  hypertrophy: { min: 65, max: 80, target: 72 },
  conditioning: { min: 50, max: 65, target: 55 },
};

/**
 * Finds PR for an exercise, trying aliases if exact match not found
 */
function findPRForExercise(
  exerciseName: string, 
  prMetrics: PRMetric[]
): PRMetric | null {
  const normalized = normalizeExerciseName(exerciseName);
  
  // Try exact match first
  const exactMatch = prMetrics.find(
    pr => normalizeExerciseName(pr.exercise) === normalized
  );
  if (exactMatch) return exactMatch;
  
  // Try aliases
  for (const [canonical, aliases] of Object.entries(EXERCISE_PR_ALIASES)) {
    if (normalized === normalizeExerciseName(canonical)) {
      // Look for any alias match in PR data
      for (const alias of aliases) {
        const aliasMatch = prMetrics.find(
          pr => normalizeExerciseName(pr.exercise) === normalizeExerciseName(alias)
        );
        if (aliasMatch) return aliasMatch;
      }
    }
    // Also check if the exercise name matches any alias
    if (aliases.some(a => normalizeExerciseName(a) === normalized)) {
      const canonicalMatch = prMetrics.find(
        pr => normalizeExerciseName(pr.exercise) === normalizeExerciseName(canonical)
      );
      if (canonicalMatch) return canonicalMatch;
    }
  }
  
  // Try fuzzy matching (word overlap)
  const normalizedWords = normalized.split(/\s+/);
  for (const pr of prMetrics) {
    const prWords = normalizeExerciseName(pr.exercise).split(/\s+/);
    const overlap = normalizedWords.filter(w => prWords.includes(w));
    if (overlap.length >= 1 && overlap.length >= normalizedWords.length * 0.5) {
      return pr;
    }
  }
  
  return null;
}

/**
 * Calculates recommended weight based on PR and goal
 */
function calculateRecommendedWeight(
  pr: PRMetric,
  goal: string,
  sessions: WorkoutSession[]
): ExercisePlan['recommendedWeight'] {
  const percentages = GOAL_PERCENTAGES[goal] || GOAL_PERCENTAGES.hypertrophy;
  
  // Calculate estimated 1RM using Epley formula if PR was done for multiple reps
  let estimated1RM = pr.maxWeight;
  if (pr.reps > 1) {
    estimated1RM = pr.maxWeight * (1 + pr.reps / 30);
  }
  
  // Calculate working weight as percentage of estimated 1RM
  const workingWeight = Math.round((estimated1RM * percentages.target) / 100 / 2.5) * 2.5; // Round to nearest 2.5
  
  // Determine confidence based on how recent the PR is
  const daysSincePR = Math.floor(
    (Date.now() - new Date(pr.date).getTime()) / (1000 * 60 * 60 * 24)
  );
  let confidence: 'high' | 'medium' | 'low' = 'high';
  if (daysSincePR > 90) {
    confidence = 'low';
  } else if (daysSincePR > 30) {
    confidence = 'medium';
  }
  
  return {
    value: workingWeight,
    unit: 'lbs',
    basedOn: 'pr',
    confidence,
    prWeight: pr.maxWeight,
    percentageOfMax: percentages.target,
  };
}

/**
 * Gets recent working weights for an exercise (last 30 days)
 */
function getRecentWorkingWeights(
  exerciseName: string,
  sessions: WorkoutSession[]
): { avgWeight: number; lastWeight: number; count: number } | null {
  const normalized = normalizeExerciseName(exerciseName);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const weights: number[] = [];
  let lastWeight = 0;
  
  for (const session of sessions) {
    if (new Date(session.performedOn) < thirtyDaysAgo) continue;
    
    for (const ex of session.exercises) {
      if (normalizeExerciseName(ex.nameRaw) === normalized) {
        for (const set of ex.sets) {
          const weight = parseFloat(set.weightText.replace(/[^\d.]/g, '')) || 0;
          if (weight > 0) {
            weights.push(weight);
            if (!lastWeight || new Date(session.performedOn) >= new Date(session.performedOn)) {
              lastWeight = weight;
            }
          }
        }
      }
    }
  }
  
  if (weights.length === 0) return null;
  
  return {
    avgWeight: weights.reduce((a, b) => a + b, 0) / weights.length,
    lastWeight,
    count: weights.length,
  };
}

/**
 * Executes Plan intent to generate workout plan
 */
export async function executePlanIntent(
  intent: PlanIntent,
  sessions: WorkoutSession[]
): Promise<WorkoutPlan> {
  const focus = intent.focus || 'full';
  const goal = intent.goal || 'hypertrophy';
  const durationMinutes = intent.durationMinutes || 60;
  const includeWeights = intent.includeWeights || false;
  const requestedExercises = intent.requestedExercises || [];

  // Calculate PRs if we need personalized weights
  const prMetrics = includeWeights ? calculatePRMetrics(sessions) : [];

  // Determine rep ranges based on goal
  const repRanges: Record<string, string> = {
    strength: '3–6',
    hypertrophy: '8–12',
    conditioning: '12–20',
  };
  const repRange = repRanges[goal] || '8–12';

  // Get exercise templates for focus
  let templates = EXERCISE_TEMPLATES[focus] || EXERCISE_TEMPLATES.full;
  
  // If user requested specific exercises, prioritize those
  if (requestedExercises.length > 0) {
    const requestedTemplates = requestedExercises.map(name => ({
      name,
      muscleGroups: [] as string[], // We don't need muscle groups for requested exercises
    }));
    // Add requested exercises first, then fill with templates
    templates = [...requestedTemplates, ...templates.filter(
      t => !requestedExercises.some(r => 
        normalizeExerciseName(r) === normalizeExerciseName(t.name)
      )
    )];
  }

  // Check recent training to avoid duplicates
  const exercisesToAvoid: string[] = [];
  const basedOnData: WorkoutPlan['basedOnData'] = {
    exercisesAvoided: [],
    prData: includeWeights ? prMetrics.map(pr => ({
      exercise: pr.exercise,
      maxWeight: pr.maxWeight,
      reps: pr.reps,
      date: pr.date,
    })) : undefined,
  };

  // Find last training days for different patterns
  if (focus === 'lower' || focus === 'legs') {
    basedOnData.lastLowerDay = findLastTrainingDay(['Quads', 'Hamstrings'], sessions) || undefined;
  }
  if (focus === 'upper') {
    basedOnData.lastUpperDay = findLastTrainingDay(['Chest', 'Back', 'Shoulders'], sessions) || undefined;
  }
  if (focus === 'push') {
    basedOnData.lastPushDay = findLastTrainingDay(['Chest', 'Shoulders'], sessions) || undefined;
  }
  if (focus === 'pull') {
    basedOnData.lastPullDay = findLastTrainingDay(['Back'], sessions) || undefined;
  }

  // Filter out recently trained exercises (but keep requested exercises)
  const availableExercises = templates.filter(template => {
    // Always keep requested exercises
    if (requestedExercises.some(r => 
      normalizeExerciseName(r) === normalizeExerciseName(template.name)
    )) {
      return true;
    }
    
    const recentlyTrained = wasTrainedRecently(template.name, sessions, 48);
    if (recentlyTrained.trained) {
      exercisesToAvoid.push(template.name);
      return false;
    }
    return true;
  });

  basedOnData.exercisesAvoided = exercisesToAvoid;

  // Determine if we have enough history
  const hasHistory = sessions.length >= 3;
  
  // Select exercises (3-5 exercises based on duration)
  const exerciseCount = Math.min(Math.max(3, Math.floor(durationMinutes / 15)), 5);
  
  // Always prefer available exercises (filtered for recent training) if we have enough
  // Only fall back to templates if we don't have enough available exercises
  const selectedExercises = availableExercises.length >= exerciseCount
    ? availableExercises.slice(0, exerciseCount)
    : availableExercises.length >= 3
      ? availableExercises.slice(0, exerciseCount)
      : templates.slice(0, exerciseCount);
  
  // Mark as generic if we don't have enough history or had to use templates
  const isGeneric = !hasHistory || selectedExercises.length < exerciseCount;
  
  const finalExercises = selectedExercises;

  const rationale: string[] = [];
  if (isGeneric) {
    rationale.push('This is a generic plan since you have limited workout history.');
  } else {
    rationale.push(`Based on your recent training, avoiding exercises trained within the last 48 hours.`);
  }
  if (basedOnData.lastLowerDay || basedOnData.lastUpperDay || basedOnData.lastPushDay || basedOnData.lastPullDay) {
    const lastDays = [
      basedOnData.lastLowerDay && `last lower day: ${new Date(basedOnData.lastLowerDay).toLocaleDateString()}`,
      basedOnData.lastUpperDay && `last upper day: ${new Date(basedOnData.lastUpperDay).toLocaleDateString()}`,
      basedOnData.lastPushDay && `last push day: ${new Date(basedOnData.lastPushDay).toLocaleDateString()}`,
      basedOnData.lastPullDay && `last pull day: ${new Date(basedOnData.lastPullDay).toLocaleDateString()}`,
    ].filter(Boolean);
    if (lastDays.length > 0) {
      rationale.push(`Your ${lastDays.join(', ')}.`);
    }
  }
  rationale.push(`Focus: ${focus}, Goal: ${goal}, Duration: ~${durationMinutes} minutes`);

  // Track if we found any personalized weights
  let hasPersonalizedWeights = false;
  const exercisesWithWeights: string[] = [];
  const exercisesWithoutWeights: string[] = [];

  const exercises: ExercisePlan[] = finalExercises.map(template => {
    const exercise: ExercisePlan = {
      exercise: template.name,
      sets: goal === 'strength' ? 4 : goal === 'conditioning' ? 4 : 3,
      reps: repRange,
      intensity: goal === 'strength' ? 'RPE 8–9' : goal === 'hypertrophy' ? 'RPE 7–8' : 'RPE 6–7',
      notes: undefined,
    };

    // Calculate personalized weight if requested
    if (includeWeights) {
      const pr = findPRForExercise(template.name, prMetrics);
      
      if (pr) {
        exercise.recommendedWeight = calculateRecommendedWeight(pr, goal, sessions);
        hasPersonalizedWeights = true;
        exercisesWithWeights.push(template.name);
        
        // Add note about the PR this is based on
        const daysSincePR = Math.floor(
          (Date.now() - new Date(pr.date).getTime()) / (1000 * 60 * 60 * 24)
        );
        if (exercise.recommendedWeight.confidence === 'low') {
          exercise.notes = `Based on ${pr.maxWeight} lbs × ${pr.reps} reps (${daysSincePR} days ago - consider retesting)`;
        } else {
          exercise.notes = `Based on your PR: ${pr.maxWeight} lbs × ${pr.reps} reps`;
        }
      } else {
        // No PR data - try to use recent working weights
        const recentWeights = getRecentWorkingWeights(template.name, sessions);
        if (recentWeights) {
          exercise.recommendedWeight = {
            value: Math.round(recentWeights.avgWeight / 2.5) * 2.5,
            unit: 'lbs',
            basedOn: 'recent',
            confidence: recentWeights.count >= 3 ? 'medium' : 'low',
          };
          exercise.notes = `Based on recent working weight avg: ${recentWeights.avgWeight.toFixed(0)} lbs`;
          hasPersonalizedWeights = true;
          exercisesWithWeights.push(template.name);
        } else {
          exercisesWithoutWeights.push(template.name);
          exercise.notes = 'No history - start light and build up';
        }
      }
    }

    return exercise;
  });

  // Add weight recommendation info to rationale
  if (includeWeights) {
    if (hasPersonalizedWeights) {
      const percentages = GOAL_PERCENTAGES[goal] || GOAL_PERCENTAGES.hypertrophy;
      rationale.push(`Weight recommendations are ~${percentages.target}% of your estimated 1RM for ${goal} training.`);
      if (exercisesWithWeights.length > 0) {
        rationale.push(`Personalized weights for: ${exercisesWithWeights.join(', ')}.`);
      }
      if (exercisesWithoutWeights.length > 0) {
        rationale.push(`No data for: ${exercisesWithoutWeights.join(', ')} - start light.`);
      }
    } else {
      rationale.push('Could not calculate personalized weights - no matching PR data found.');
    }
  }

  const title = `${focus.charAt(0).toUpperCase() + focus.slice(1)} ${goal.charAt(0).toUpperCase() + goal.slice(1)} Workout`;

  return {
    title,
    rationale,
    exercises,
    basedOnData,
    isGeneric,
    hasPersonalizedWeights,
  };
}

