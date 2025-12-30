// ai/intents/askExecutor.ts
// Deterministic executor for Ask mode intents

import { calculateStatsFromSessions } from '@/utils/analytics/calculateStats';
import { computeVolumeForExercise, getWeekFromDate } from '@/utils/helpers';
import { calculatePRMetrics } from '@/utils/pr/calculatePRMetrics';
import { WorkoutExercise, WorkoutSession } from '@/utils/workoutSessions';
import { AskIntent } from './askSchema';

export interface AskResult {
  answerText: string;
  data: {
    date?: string;
    exercise?: string;
    matchedExercise?: string; // The actual exercise name we matched
    sets?: Array<{ reps: number; weight: string }>;
    topSet?: { reps: number; weight: string };
    bestWeight?: number;
    bestReps?: number;
    bestE1RM?: number;
    bestVolume?: number;
    volume?: number;
    setsCount?: number;
    sources?: string[];
    sessionDate?: string;
    sessionExercises?: Array<{ name: string; sets: number; reps: number[]; weights: string[] }>;
    suggestions?: string[]; // Similar exercises if no match found
  };
}

/**
 * Exercise alternatives database
 * Maps exercises to their alternatives with similar muscle targets
 */
const EXERCISE_ALTERNATIVES: Record<string, string[]> = {
  'bench press': ['dumbbell bench press', 'push-ups', 'chest press machine', 'floor press', 'dips'],
  'squat': ['leg press', 'goblet squat', 'hack squat', 'lunges', 'bulgarian split squat'],
  'deadlift': ['romanian deadlift', 'trap bar deadlift', 'rack pulls', 'hip thrust', 'good mornings'],
  'overhead press': ['dumbbell shoulder press', 'arnold press', 'landmine press', 'pike push-ups', 'machine shoulder press'],
  'barbell row': ['dumbbell row', 'cable row', 'chest supported row', 't-bar row', 'inverted row'],
  'pull up': ['lat pulldown', 'assisted pull-up', 'negative pull-ups', 'cable pulldown', 'inverted row'],
  'lat pulldown': ['pull-ups', 'straight arm pulldown', 'cable row', 'dumbbell pullover'],
  'leg press': ['squat', 'hack squat', 'lunges', 'leg extension + leg curl combo'],
  'bicep curl': ['hammer curl', 'preacher curl', 'concentration curl', 'cable curl', 'chin-ups'],
  'tricep pushdown': ['skull crushers', 'overhead tricep extension', 'close grip bench', 'dips', 'diamond push-ups'],
  'lateral raise': ['cable lateral raise', 'machine lateral raise', 'upright row', 'face pulls'],
  'leg extension': ['sissy squat', 'front squat', 'bulgarian split squat', 'step-ups'],
  'leg curl': ['romanian deadlift', 'nordic curl', 'glute ham raise', 'stability ball curl'],
  'calf raise': ['seated calf raise', 'donkey calf raise', 'single leg calf raise', 'jump rope'],
  'dip': ['close grip bench press', 'tricep pushdown', 'push-ups', 'machine dip'],
  'hip thrust': ['glute bridge', 'cable pull-through', 'romanian deadlift', 'back extension'],
  'incline bench press': ['incline dumbbell press', 'landmine press', 'low-to-high cable fly', 'incline push-ups'],
  'front squat': ['goblet squat', 'zercher squat', 'leg press', 'hack squat'],
  'romanian deadlift': ['stiff leg deadlift', 'good mornings', 'cable pull-through', 'hip thrust'],
};

/**
 * Muscle group to exercises mapping for recommendations
 */
const MUSCLE_GROUP_EXERCISES: Record<string, string[]> = {
  chest: ['bench press', 'incline bench press', 'dumbbell fly', 'push-ups', 'cable fly', 'dips', 'decline bench press', 'pec deck'],
  back: ['pull-ups', 'barbell row', 'lat pulldown', 'cable row', 'dumbbell row', 'face pulls', 'deadlift', 't-bar row'],
  shoulders: ['overhead press', 'lateral raise', 'face pulls', 'arnold press', 'rear delt fly', 'front raise', 'upright row'],
  legs: ['squat', 'leg press', 'lunges', 'leg curl', 'leg extension', 'calf raise', 'hip thrust', 'romanian deadlift'],
  arms: ['bicep curl', 'tricep pushdown', 'hammer curl', 'skull crushers', 'preacher curl', 'dips', 'chin-ups'],
  upper: ['bench press', 'overhead press', 'pull-ups', 'barbell row', 'lateral raise', 'bicep curl'],
  lower: ['squat', 'deadlift', 'leg press', 'lunges', 'leg curl', 'hip thrust'],
  push: ['bench press', 'overhead press', 'incline bench press', 'tricep pushdown', 'lateral raise'],
  pull: ['pull-ups', 'barbell row', 'lat pulldown', 'face pulls', 'bicep curl', 'deadlift'],
  // Specific muscle groups
  quads: ['squat', 'leg press', 'leg extension', 'front squat', 'lunges', 'hack squat', 'sissy squat', 'step-ups'],
  hamstrings: ['romanian deadlift', 'leg curl', 'stiff leg deadlift', 'good mornings', 'nordic curl', 'glute ham raise'],
  glutes: ['hip thrust', 'romanian deadlift', 'squat', 'lunges', 'glute bridge', 'cable pull-through', 'step-ups'],
  biceps: ['bicep curl', 'hammer curl', 'preacher curl', 'concentration curl', 'chin-ups', 'cable curl', 'incline curl'],
  triceps: ['tricep pushdown', 'skull crushers', 'overhead tricep extension', 'close grip bench press', 'dips', 'diamond push-ups'],
  calves: ['standing calf raise', 'seated calf raise', 'donkey calf raise', 'leg press calf raise', 'single leg calf raise'],
  core: ['plank', 'crunches', 'leg raises', 'russian twists', 'ab wheel', 'cable woodchops', 'dead bug'],
  abs: ['crunches', 'leg raises', 'plank', 'sit-ups', 'cable crunches', 'hanging leg raises', 'ab wheel'],
  lats: ['lat pulldown', 'pull-ups', 'dumbbell row', 'cable row', 'straight arm pulldown', 'barbell row'],
  traps: ['shrugs', 'face pulls', 'upright row', 'farmer walks', 'rack pulls', 'deadlift'],
  forearms: ['wrist curls', 'reverse wrist curls', 'farmer walks', 'dead hangs', 'grip trainers'],
};

/**
 * Common exercise aliases and variations
 * Maps informal/short names to canonical exercise names
 */
const EXERCISE_ALIASES: Record<string, string[]> = {
  'bench press': ['bench', 'benched', 'benching', 'flat bench', 'bb bench', 'barbell bench'],
  'incline bench press': ['incline bench', 'incline', 'incline press'],
  'squat': ['squats', 'squatted', 'squatting', 'back squat', 'bb squat', 'barbell squat'],
  'front squat': ['front squats', 'fs'],
  'deadlift': ['deadlifts', 'deadlifted', 'dl', 'conventional deadlift', 'conv dl'],
  'romanian deadlift': ['rdl', 'rdls', 'romanian', 'stiff leg', 'sldl'],
  'overhead press': ['ohp', 'press', 'shoulder press', 'military press', 'standing press'],
  'pull up': ['pullup', 'pullups', 'pull ups', 'chin up', 'chinup', 'chinups', 'chin ups'],
  'lat pulldown': ['pulldown', 'pulldowns', 'lat pull', 'lat pulls'],
  'barbell row': ['bb row', 'bent over row', 'bent row', 'rows', 'row'],
  'dumbbell row': ['db row', 'db rows', 'one arm row'],
  'leg press': ['leg pressed', 'legpress'],
  'leg extension': ['leg extensions', 'leg ext', 'quad extension'],
  'leg curl': ['leg curls', 'hamstring curl', 'lying leg curl'],
  'calf raise': ['calf raises', 'calves', 'calf'],
  'bicep curl': ['curls', 'curl', 'bicep curls', 'biceps', 'arm curl', 'db curl', 'barbell curl'],
  'tricep pushdown': ['pushdown', 'pushdowns', 'tricep extension', 'triceps'],
  'lateral raise': ['lateral raises', 'side raise', 'side raises', 'lat raise'],
  'cable fly': ['cable flies', 'cable flys', 'fly', 'flies'],
  'pec deck fly': ['pec deck', 'pec fly', 'chest fly'],
  'dip': ['dips', 'dipping', 'chest dip', 'tricep dip'],
  'hip thrust': ['hip thrusts', 'glute bridge', 'barbell hip thrust'],
  'lunge': ['lunges', 'walking lunge', 'walking lunges'],
};

/**
 * Normalizes exercise name for matching (lowercase, strip punctuation)
 */
function normalizeExerciseName(name: string): string {
  return name.toLowerCase().replace(/[^\w\s]/g, '').trim();
}

/**
 * Calculates similarity score between two strings (0-1)
 * Uses a combination of substring matching and word overlap
 */
function calculateSimilarity(query: string, target: string): number {
  const q = normalizeExerciseName(query);
  const t = normalizeExerciseName(target);
  
  // Exact match
  if (q === t) return 1.0;
  
  // Check if query is contained in target or vice versa
  if (t.includes(q) || q.includes(t)) return 0.9;
  
  // Check word overlap
  const qWords = q.split(/\s+/);
  const tWords = t.split(/\s+/);
  const overlap = qWords.filter(w => tWords.some(tw => tw.includes(w) || w.includes(tw)));
  if (overlap.length > 0) {
    return 0.5 + (overlap.length / Math.max(qWords.length, tWords.length)) * 0.4;
  }
  
  // Check if any word starts with the same letters
  for (const qw of qWords) {
    for (const tw of tWords) {
      if (qw.length >= 3 && tw.startsWith(qw.substring(0, 3))) return 0.4;
      if (tw.length >= 3 && qw.startsWith(tw.substring(0, 3))) return 0.4;
    }
  }
  
  return 0;
}

/**
 * Resolves an exercise query to a canonical name using aliases
 */
function resolveExerciseAlias(query: string): string | null {
  const normalized = normalizeExerciseName(query);
  
  // Check if query matches any alias
  for (const [canonical, aliases] of Object.entries(EXERCISE_ALIASES)) {
    if (canonical === normalized) return canonical;
    for (const alias of aliases) {
      if (alias === normalized) return canonical;
    }
  }
  
  return null;
}

/**
 * Gets all unique exercise names from sessions
 */
function getAllExerciseNames(sessions: WorkoutSession[]): string[] {
  const names = new Set<string>();
  for (const session of sessions) {
    for (const ex of session.exercises) {
      names.add(ex.nameRaw);
    }
  }
  return Array.from(names);
}

/**
 * Finds the best matching exercise name from the user's history
 */
function findBestMatch(query: string, sessions: WorkoutSession[]): { 
  match: string | null; 
  score: number;
  suggestions: string[];
} {
  const allExercises = getAllExerciseNames(sessions);
  const normalizedQuery = normalizeExerciseName(query);
  
  // First, try to resolve via alias
  const aliasMatch = resolveExerciseAlias(query);
  if (aliasMatch) {
    // Find an exercise in history that matches the canonical name
    for (const exName of allExercises) {
      const normalizedEx = normalizeExerciseName(exName);
      if (normalizedEx === aliasMatch || calculateSimilarity(aliasMatch, normalizedEx) >= 0.8) {
        return { match: exName, score: 1.0, suggestions: [] };
      }
    }
  }
  
  // Calculate similarity scores for all exercises
  const scored = allExercises.map(exName => ({
    name: exName,
    score: calculateSimilarity(query, exName),
  })).sort((a, b) => b.score - a.score);
  
  // If we have a good match (>= 0.5), use it
  if (scored.length > 0 && scored[0].score >= 0.5) {
    return { 
      match: scored[0].name, 
      score: scored[0].score,
      suggestions: scored.slice(1, 4).filter(s => s.score >= 0.3).map(s => s.name),
    };
  }
  
  // No good match, return suggestions
  return { 
    match: null, 
    score: 0,
    suggestions: scored.slice(0, 3).map(s => s.name),
  };
}

/**
 * Finds matching exercises using smart matching
 */
function findMatchingExercises(exerciseName: string, sessions: WorkoutSession[]): {
  exercises: WorkoutExercise[];
  matchedName: string | null;
  suggestions: string[];
} {
  const { match, suggestions } = findBestMatch(exerciseName, sessions);
  
  if (!match) {
    return { exercises: [], matchedName: null, suggestions };
  }
  
  const normalizedMatch = normalizeExerciseName(match);
  const matches: WorkoutExercise[] = [];
  
  for (const session of sessions) {
    for (const ex of session.exercises) {
      if (normalizeExerciseName(ex.nameRaw) === normalizedMatch) {
        matches.push(ex);
      }
    }
  }
  
  return { exercises: matches, matchedName: match, suggestions };
}

/**
 * Calculates estimated 1RM using Epley formula: weight × (1 + reps/30)
 */
function calculateE1RM(weight: number, reps: number): number {
  if (reps === 0) return 0;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

/**
 * Executes Ask intent against workout sessions
 */
export async function executeAskIntent(
  intent: AskIntent,
  sessions: WorkoutSession[]
): Promise<AskResult> {
  if (sessions.length === 0) {
    return {
      answerText: "You don't have any workout data yet. Start logging workouts to see your progress!",
      data: { sources: [] },
    };
  }

  switch (intent.type) {
    case 'last_exercise_date': {
      const { exercises: matches, matchedName, suggestions } = findMatchingExercises(intent.exercise, sessions);
      if (matches.length === 0 || !matchedName) {
        const suggestionText = suggestions.length > 0 
          ? ` Did you mean: ${suggestions.join(', ')}?`
          : '';
        return {
          answerText: `I couldn't find any workouts for "${intent.exercise}".${suggestionText}`,
          data: { exercise: intent.exercise, suggestions, sources: [] },
        };
      }

      // Find the most recent session containing this exercise
      let latestSession: WorkoutSession | null = null;
      let latestExercise: WorkoutExercise | null = null;
      let latestDate = '';

      const normalizedMatch = normalizeExerciseName(matchedName);
      for (const session of sessions) {
        for (const ex of session.exercises) {
          if (normalizeExerciseName(ex.nameRaw) === normalizedMatch) {
            if (!latestSession || session.performedOn > latestDate) {
              latestSession = session;
              latestExercise = ex;
              latestDate = session.performedOn;
            }
          }
        }
      }

      if (!latestSession || !latestExercise) {
        return {
          answerText: `I couldn't find any workouts for "${intent.exercise}".`,
          data: { exercise: intent.exercise, sources: [] },
        };
      }

      const date = new Date(latestDate);
      const displayName = matchedName;
      return {
        answerText: `You last did ${displayName} on ${date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.`,
        data: {
          date: latestDate,
          exercise: intent.exercise,
          matchedExercise: displayName,
          sources: [latestSession.id],
        },
      };
    }

    case 'last_exercise_details': {
      const { exercises: matches, matchedName, suggestions } = findMatchingExercises(intent.exercise, sessions);
      if (matches.length === 0 || !matchedName) {
        const suggestionText = suggestions.length > 0 
          ? ` Did you mean: ${suggestions.join(', ')}?`
          : '';
        return {
          answerText: `I couldn't find any workouts for "${intent.exercise}".${suggestionText}`,
          data: { exercise: intent.exercise, suggestions, sources: [] },
        };
      }

      // Find most recent exercise instance
      let latestSession: WorkoutSession | null = null;
      let latestExercise: WorkoutExercise | null = null;
      let latestDate = '';

      const normalizedMatch = normalizeExerciseName(matchedName);
      for (const session of sessions) {
        for (const ex of session.exercises) {
          if (normalizeExerciseName(ex.nameRaw) === normalizedMatch) {
            if (!latestSession || session.performedOn > latestDate) {
              latestSession = session;
              latestExercise = ex;
              latestDate = session.performedOn;
            }
          }
        }
      }

      if (!latestSession || !latestExercise) {
        return {
          answerText: `I couldn't find any workouts for "${intent.exercise}".`,
          data: { exercise: intent.exercise, sources: [] },
        };
      }

      const sets = latestExercise.sets.map(set => ({
        reps: set.reps,
        weight: set.weightText,
      }));

      const topSet = sets.reduce((best, current) => {
        const currentWeight = parseFloat(current.weight.replace(/[^\d.]/g, '')) || 0;
        const bestWeight = parseFloat(best.weight.replace(/[^\d.]/g, '')) || 0;
        if (currentWeight > bestWeight || (currentWeight === bestWeight && current.reps > best.reps)) {
          return current;
        }
        return best;
      }, sets[0]);

      const displayName = matchedName;
      return {
        answerText: `Last time you did ${displayName}, you performed ${sets.length} sets: ${sets.map(s => `${s.reps} reps @ ${s.weight}`).join(', ')}.`,
        data: {
          date: latestDate,
          exercise: intent.exercise,
          matchedExercise: displayName,
          sets,
          topSet,
          sources: [latestSession.id],
        },
      };
    }

    case 'best_exercise': {
      const { exercises: matches, matchedName, suggestions } = findMatchingExercises(intent.exercise, sessions);
      if (matches.length === 0 || !matchedName) {
        const suggestionText = suggestions.length > 0 
          ? ` Did you mean: ${suggestions.join(', ')}?`
          : '';
        return {
          answerText: `I couldn't find any workouts for "${intent.exercise}".${suggestionText}`,
          data: { exercise: intent.exercise, suggestions, sources: [] },
        };
      }

      const prMetrics = calculatePRMetrics(sessions);
      const exerciseKey = normalizeExerciseName(matchedName);
      const pr = prMetrics.find(m => normalizeExerciseName(m.exercise) === exerciseKey);

      if (!pr) {
        return {
          answerText: `I couldn't find any PR data for "${matchedName}".`,
          data: { exercise: intent.exercise, matchedExercise: matchedName, sources: [] },
        };
      }

      const displayName = matchedName;
      if (intent.metric === 'weight') {
        return {
          answerText: `Your best ${displayName} is ${pr.maxWeight} lbs for ${pr.reps} reps, achieved on ${new Date(pr.date).toLocaleDateString()}.`,
          data: {
            exercise: intent.exercise,
            matchedExercise: displayName,
            bestWeight: pr.maxWeight,
            bestReps: pr.reps,
            date: pr.date,
            sources: [],
          },
        };
      }

      if (intent.metric === 'e1rm') {
        const e1rm = calculateE1RM(pr.maxWeight, pr.reps);
        return {
          answerText: `Your estimated 1RM for ${displayName} is ${e1rm.toFixed(1)} lbs (based on ${pr.maxWeight} lbs × ${pr.reps} reps).`,
          data: {
            exercise: intent.exercise,
            matchedExercise: displayName,
            bestE1RM: e1rm,
            bestWeight: pr.maxWeight,
            bestReps: pr.reps,
            date: pr.date,
            sources: [],
          },
        };
      }

      if (intent.metric === 'volume') {
        // Find exercise with highest volume
        let bestVolume = 0;
        let bestSession: WorkoutSession | null = null;
        let bestExerciseMatch: WorkoutExercise | null = null;

        for (const session of sessions) {
          for (const ex of session.exercises) {
            if (normalizeExerciseName(ex.nameRaw) === exerciseKey) {
              const volume = computeVolumeForExercise(ex);
              if (volume > bestVolume) {
                bestVolume = volume;
                bestSession = session;
                bestExerciseMatch = ex;
              }
            }
          }
        }

        if (bestVolume === 0) {
          return {
            answerText: `I couldn't calculate volume for "${displayName}".`,
            data: { exercise: intent.exercise, matchedExercise: displayName, sources: [] },
          };
        }

        return {
          answerText: `Your best volume for ${displayName} is ${bestVolume.toFixed(0)} lbs (from ${bestSession?.performedOn || 'unknown date'}).`,
          data: {
            exercise: intent.exercise,
            matchedExercise: displayName,
            bestVolume,
            date: bestSession?.performedOn,
            sources: bestSession ? [bestSession.id] : [],
          },
        };
      }

      return {
        answerText: `Unknown metric "${intent.metric}" for best exercise query.`,
        data: { exercise: intent.exercise, sources: [] },
      };
    }

    case 'volume_summary': {
      const now = new Date();
      let startDate: Date;
      let endDate: Date = now;

      if (intent.range === 'week') {
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else if (intent.range === 'month') {
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      } else if (intent.range === 'custom' && intent.start && intent.end) {
        startDate = new Date(intent.start);
        endDate = new Date(intent.end);
      } else {
        return {
          answerText: 'Invalid date range for volume summary.',
          data: { sources: [] },
        };
      }

      // Filter sessions in range
      const filteredSessions = sessions.filter(s => {
        const sessionDate = new Date(s.performedOn);
        return sessionDate >= startDate && sessionDate <= endDate;
      });

      if (filteredSessions.length === 0) {
        return {
          answerText: `No workouts found in the specified time range.`,
          data: { sources: [] },
        };
      }

      let totalSets = 0;
      const sources: string[] = [];
      let matchedExerciseName: string | undefined;

      if (intent.exercise) {
        // Volume for specific exercise - use smart matching
        const { match, suggestions } = findBestMatch(intent.exercise, filteredSessions);
        if (!match) {
          const suggestionText = suggestions.length > 0 
            ? ` Did you mean: ${suggestions.join(', ')}?`
            : '';
          return {
            answerText: `I couldn't find "${intent.exercise}" in your recent workouts.${suggestionText}`,
            data: { exercise: intent.exercise, suggestions, sources: [] },
          };
        }
        matchedExerciseName = match;
        const exerciseKey = normalizeExerciseName(match);
        for (const session of filteredSessions) {
          for (const ex of session.exercises) {
            if (normalizeExerciseName(ex.nameRaw) === exerciseKey) {
              totalSets += ex.sets.length;
              sources.push(session.id);
            }
          }
        }
      } else if (intent.muscleGroup) {
        // Volume for muscle group (use analytics)
        const stats = calculateStatsFromSessions(filteredSessions, {
          currentWeek: getWeekFromDate(now.toISOString()),
        });
        const groupStats = stats.workoutStats.muscleGroupStats[intent.muscleGroup];
        if (groupStats) {
          // Sum sets across weeks
          totalSets = Object.values(groupStats.weeklySets.direct).reduce((sum, sets) => sum + sets, 0);
        }
      } else {
        // Total volume
        for (const session of filteredSessions) {
          totalSets += session.exercises.reduce((sum, ex) => sum + ex.sets.length, 0);
          sources.push(session.id);
        }
      }

      const rangeLabel = intent.range === 'week' ? 'last week' : intent.range === 'month' ? 'last month' : 'specified period';
      const targetLabel = matchedExerciseName 
        ? `for ${matchedExerciseName}` 
        : intent.exercise 
          ? `for ${intent.exercise}` 
          : intent.muscleGroup 
            ? `for ${intent.muscleGroup}` 
            : 'total';

      return {
        answerText: `You performed ${totalSets} sets ${targetLabel} in the ${rangeLabel}.`,
        data: {
          setsCount: totalSets,
          matchedExercise: matchedExerciseName,
          sources,
        },
      };
    }

    case 'last_session_summary': {
      const sortedSessions = [...sessions].sort((a, b) => 
        new Date(b.performedOn).getTime() - new Date(a.performedOn).getTime()
      );

      if (sortedSessions.length === 0) {
        return {
          answerText: "You don't have any workout sessions yet.",
          data: { sources: [] },
        };
      }

      const lastSession = sortedSessions[0];
      const exercises = lastSession.exercises.map(ex => ({
        name: ex.nameRaw,
        sets: ex.sets.length,
        reps: ex.sets.map(s => s.reps),
        weights: ex.sets.map(s => s.weightText),
      }));

      const date = new Date(lastSession.performedOn);
      return {
        answerText: `Your last workout was on ${date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}. You did ${exercises.length} exercises: ${exercises.map(e => e.name).join(', ')}.`,
        data: {
          sessionDate: lastSession.performedOn,
          sessionExercises: exercises,
          sources: [lastSession.id],
        },
      };
    }

    case 'workout_recommendation': {
      // Analyze recent workout history to suggest what to train next
      const sortedSessions = [...sessions].sort((a, b) => 
        new Date(b.performedOn).getTime() - new Date(a.performedOn).getTime()
      );

      // Count muscle groups worked in last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const recentExercises = new Map<string, { count: number; lastDate: string }>();
      const muscleGroupsWorked = new Map<string, number>();

      for (const session of sortedSessions) {
        if (new Date(session.performedOn) < sevenDaysAgo) break;
        
        for (const ex of session.exercises) {
          const exName = normalizeExerciseName(ex.nameRaw);
          const existing = recentExercises.get(exName);
          if (!existing) {
            recentExercises.set(exName, { count: 1, lastDate: session.performedOn });
          } else {
            existing.count++;
          }
          
          // Map to muscle groups
          for (const [group, exercises] of Object.entries(MUSCLE_GROUP_EXERCISES)) {
            if (exercises.some(e => exName.includes(normalizeExerciseName(e)) || normalizeExerciseName(e).includes(exName))) {
              muscleGroupsWorked.set(group, (muscleGroupsWorked.get(group) || 0) + 1);
            }
          }
        }
      }

      // Find least trained muscle groups
      const allGroups = ['chest', 'back', 'shoulders', 'legs', 'arms'];
      const groupCounts = allGroups.map(g => ({ 
        group: g, 
        count: muscleGroupsWorked.get(g) || 0 
      })).sort((a, b) => a.count - b.count);

      // If user specified a focus, prioritize that
      const targetFocus = intent.focus && intent.focus !== 'any' ? intent.focus : null;
      
      let suggestedGroup: string;
      let suggestedExercises: string[];
      
      if (targetFocus && MUSCLE_GROUP_EXERCISES[targetFocus]) {
        suggestedGroup = targetFocus;
        suggestedExercises = MUSCLE_GROUP_EXERCISES[targetFocus].slice(0, 4);
      } else {
        // Suggest least trained group
        suggestedGroup = groupCounts[0].group;
        suggestedExercises = MUSCLE_GROUP_EXERCISES[suggestedGroup]?.slice(0, 4) || [];
      }

      const daysSinceLastWorkout = sortedSessions.length > 0 
        ? Math.floor((Date.now() - new Date(sortedSessions[0].performedOn).getTime()) / (1000 * 60 * 60 * 24))
        : null;

      let answerText: string;
      if (daysSinceLastWorkout !== null && daysSinceLastWorkout > 3) {
        answerText = `It's been ${daysSinceLastWorkout} days since your last workout! Based on your history, I'd suggest hitting ${suggestedGroup}. Try: ${suggestedExercises.join(', ')}.`;
      } else if (groupCounts[0].count === 0) {
        answerText = `You haven't trained ${suggestedGroup} this week. Consider hitting ${suggestedGroup} today! Exercises: ${suggestedExercises.join(', ')}.`;
      } else {
        answerText = `Based on your recent training, ${suggestedGroup} could use some attention. Suggested exercises: ${suggestedExercises.join(', ')}.`;
      }

      return {
        answerText,
        data: {
          suggestions: suggestedExercises,
          sources: sortedSessions.slice(0, 3).map(s => s.id),
        },
      };
    }

    case 'exercise_alternative': {
      const queryNormalized = normalizeExerciseName(intent.exercise);
      
      // First try to find in our alternatives database
      let alternatives: string[] = [];
      let matchedExercise: string | null = null;

      // Direct lookup
      for (const [exercise, alts] of Object.entries(EXERCISE_ALTERNATIVES)) {
        if (normalizeExerciseName(exercise) === queryNormalized) {
          alternatives = alts;
          matchedExercise = exercise;
          break;
        }
      }

      // Try alias resolution
      if (alternatives.length === 0) {
        const resolved = resolveExerciseAlias(intent.exercise);
        if (resolved && EXERCISE_ALTERNATIVES[resolved]) {
          alternatives = EXERCISE_ALTERNATIVES[resolved];
          matchedExercise = resolved;
        }
      }

      // Try fuzzy matching
      if (alternatives.length === 0) {
        for (const [exercise, alts] of Object.entries(EXERCISE_ALTERNATIVES)) {
          if (calculateSimilarity(intent.exercise, exercise) >= 0.5) {
            alternatives = alts;
            matchedExercise = exercise;
            break;
          }
        }
      }

      if (alternatives.length > 0 && matchedExercise) {
        const reasonText = intent.reason 
          ? ` Since you mentioned "${intent.reason}", some of these might work better for your situation.`
          : '';
        return {
          answerText: `Great alternatives to ${matchedExercise}: ${alternatives.slice(0, 4).join(', ')}.${reasonText}`,
          data: {
            exercise: intent.exercise,
            matchedExercise,
            suggestions: alternatives,
            sources: [],
          },
        };
      }

      // Fallback: suggest based on what the user has done before
      const { match, suggestions } = findBestMatch(intent.exercise, sessions);
      if (match) {
        return {
          answerText: `I don't have specific alternatives for "${intent.exercise}", but based on your history, you might try similar exercises you've done: ${suggestions.length > 0 ? suggestions.join(', ') : 'check your exercise history for ideas'}.`,
          data: {
            exercise: intent.exercise,
            suggestions,
            sources: [],
          },
        };
      }

      return {
        answerText: `I don't have alternatives for "${intent.exercise}" in my database. Try searching for exercises that target the same muscle group!`,
        data: { exercise: intent.exercise, sources: [] },
      };
    }

    case 'exercise_progress': {
      // Analyze progress/trends for a specific exercise
      const { exercises: matches, matchedName, suggestions } = findMatchingExercises(intent.exercise, sessions);
      
      if (matches.length === 0 || !matchedName) {
        const suggestionText = suggestions.length > 0 
          ? ` Did you mean: ${suggestions.join(', ')}?`
          : '';
        return {
          answerText: `I couldn't find any workouts for "${intent.exercise}".${suggestionText}`,
          data: { exercise: intent.exercise, suggestions, sources: [] },
        };
      }

      // Get all sessions with this exercise, sorted by date
      const normalizedMatch = normalizeExerciseName(matchedName);
      const exerciseSessions: Array<{
        date: string;
        topWeight: number;
        topReps: number;
        totalVolume: number;
        sets: number;
      }> = [];

      for (const session of sessions) {
        for (const ex of session.exercises) {
          if (normalizeExerciseName(ex.nameRaw) === normalizedMatch) {
            let topWeight = 0;
            let topReps = 0;
            let totalVolume = 0;
            
            for (const set of ex.sets) {
              // Parse weight from weightText (e.g., "185 lbs" -> 185)
              const weight = parseFloat(set.weightText.replace(/[^\d.]/g, '')) || 0;
              if (weight > topWeight) {
                topWeight = weight;
                topReps = set.reps;
              } else if (weight === topWeight && set.reps > topReps) {
                topReps = set.reps;
              }
              totalVolume += weight * set.reps;
            }
            
            exerciseSessions.push({
              date: session.performedOn,
              topWeight,
              topReps,
              totalVolume,
              sets: ex.sets.length,
            });
          }
        }
      }

      // Sort by date (oldest first for trend analysis)
      exerciseSessions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      if (exerciseSessions.length < 2) {
        return {
          answerText: `You've only done ${matchedName} ${exerciseSessions.length === 1 ? 'once' : 'never'}. Keep training and I'll be able to track your progress!`,
          data: { 
            exercise: intent.exercise, 
            matchedExercise: matchedName,
            sources: [] 
          },
        };
      }

      // Filter by timeframe if specified
      let relevantSessions = exerciseSessions;
      const now = new Date();
      
      if (intent.timeframe === 'month') {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        relevantSessions = exerciseSessions.filter(s => new Date(s.date) >= monthAgo);
      } else if (intent.timeframe === 'recent') {
        // Last 5 sessions or last 2 weeks, whichever is more
        const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
        const recentByDate = exerciseSessions.filter(s => new Date(s.date) >= twoWeeksAgo);
        relevantSessions = recentByDate.length >= 2 ? recentByDate : exerciseSessions.slice(-5);
      }

      if (relevantSessions.length < 2) {
        relevantSessions = exerciseSessions.slice(-5); // Fallback to last 5
      }

      // Calculate progress
      const first = relevantSessions[0];
      const last = relevantSessions[relevantSessions.length - 1];
      
      const weightChange = last.topWeight - first.topWeight;
      const weightChangePercent = first.topWeight > 0 
        ? ((weightChange / first.topWeight) * 100).toFixed(1) 
        : '0';
      
      // Calculate e1RM for better comparison
      const firstE1RM = calculateE1RM(first.topWeight, first.topReps);
      const lastE1RM = calculateE1RM(last.topWeight, last.topReps);
      const e1rmChange = lastE1RM - firstE1RM;
      const e1rmChangePercent = firstE1RM > 0 
        ? ((e1rmChange / firstE1RM) * 100).toFixed(1) 
        : '0';

      // Build the response
      const displayName = matchedName;
      const sessionCount = relevantSessions.length;
      const timeframeLabel = intent.timeframe === 'month' 
        ? 'this month' 
        : intent.timeframe === 'all_time' 
          ? 'overall' 
          : 'recently';

      let progressDescription: string;
      let emoji: string;
      
      if (e1rmChange > 0) {
        emoji = '📈';
        if (parseFloat(e1rmChangePercent) >= 10) {
          progressDescription = `Your ${displayName} is up significantly! ${emoji}`;
        } else if (parseFloat(e1rmChangePercent) >= 5) {
          progressDescription = `Nice progress on ${displayName}! ${emoji}`;
        } else {
          progressDescription = `Your ${displayName} is trending up slightly. ${emoji}`;
        }
      } else if (e1rmChange < 0) {
        emoji = '📉';
        if (parseFloat(e1rmChangePercent) <= -10) {
          progressDescription = `Your ${displayName} has dropped ${timeframeLabel}. ${emoji} Could be fatigue or time for a deload.`;
        } else {
          progressDescription = `Your ${displayName} is down slightly ${timeframeLabel}. ${emoji} Normal fluctuation.`;
        }
      } else {
        emoji = '➡️';
        progressDescription = `Your ${displayName} has been consistent ${timeframeLabel}. ${emoji}`;
      }

      // Build detailed answer
      const firstDate = new Date(first.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      const lastDate = new Date(last.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      
      let answerText = `${progressDescription}\n\n`;
      answerText += `${firstDate}: ${first.topWeight} lbs × ${first.topReps} reps\n`;
      answerText += `${lastDate}: ${last.topWeight} lbs × ${last.topReps} reps\n\n`;
      
      if (weightChange !== 0) {
        const direction = weightChange > 0 ? 'up' : 'down';
        answerText += `Top weight ${direction} ${Math.abs(weightChange)} lbs (${weightChange > 0 ? '+' : ''}${weightChangePercent}%)`;
      } else if (last.topReps !== first.topReps) {
        const repChange = last.topReps - first.topReps;
        answerText += `Same weight, ${repChange > 0 ? '+' : ''}${repChange} reps`;
      }

      return {
        answerText,
        data: {
          exercise: intent.exercise,
          matchedExercise: displayName,
          progressData: {
            sessionCount,
            firstSession: first,
            lastSession: last,
            weightChange,
            weightChangePercent: parseFloat(weightChangePercent),
            e1rmChange,
            e1rmChangePercent: parseFloat(e1rmChangePercent),
            trend: e1rmChange > 0 ? 'improving' : e1rmChange < 0 ? 'declining' : 'stable',
          },
          sources: [],
        },
      };
    }

    case 'muscle_group_exercises': {
      // Signal that this needs LLM response - provide context data
      const muscleGroup = intent.muscleGroup.toLowerCase().trim();
      
      // Find exercises for this muscle group
      let exercises: string[] | undefined;
      let matchedGroup: string | undefined;
      
      if (MUSCLE_GROUP_EXERCISES[muscleGroup]) {
        exercises = MUSCLE_GROUP_EXERCISES[muscleGroup];
        matchedGroup = muscleGroup;
      } else {
        for (const [group, exList] of Object.entries(MUSCLE_GROUP_EXERCISES)) {
          if (group.includes(muscleGroup) || muscleGroup.includes(group)) {
            exercises = exList;
            matchedGroup = group;
            break;
          }
        }
      }
      
      // Get user's exercise history for context
      const allUserExercises = getAllExerciseNames(sessions);
      const doneExercises = exercises?.filter(ex => 
        allUserExercises.some(userEx => 
          normalizeExerciseName(userEx).includes(normalizeExerciseName(ex)) ||
          normalizeExerciseName(ex).includes(normalizeExerciseName(userEx))
        )
      ) || [];
      
      // Return with flag indicating LLM should respond
      return {
        answerText: '', // Will be filled by LLM
        data: {
          _needsLLMResponse: true,
          _llmContext: {
            type: 'muscle_group_exercises',
            muscleGroup: matchedGroup || intent.muscleGroup,
            suggestedExercises: exercises?.slice(0, 8) || [],
            exercisesUserHasDone: doneExercises.slice(0, 5),
            originalQuery: `What exercises hit ${intent.muscleGroup}?`,
          },
          suggestions: exercises,
          sources: [],
        },
      };
    }

    case 'general_chat': {
      // Build context about user's training for LLM
      const sortedSessions = [...sessions].sort((a, b) => 
        new Date(b.performedOn).getTime() - new Date(a.performedOn).getTime()
      );
      const lastWorkout = sortedSessions[0];
      const daysSince = lastWorkout 
        ? Math.floor((Date.now() - new Date(lastWorkout.performedOn).getTime()) / (1000 * 60 * 60 * 24))
        : null;
      
      // Get some stats for context
      const totalWorkouts = sessions.length;
      const recentExercises = lastWorkout?.exercises.map(e => e.nameRaw).slice(0, 5) || [];
      
      return {
        answerText: '', // Will be filled by LLM
        data: {
          _needsLLMResponse: true,
          _llmContext: {
            type: 'general_chat',
            originalQuery: intent.originalQuery,
            topic: intent.topic,
            userContext: {
              totalWorkouts,
              daysSinceLastWorkout: daysSince,
              recentExercises,
              lastWorkoutDate: lastWorkout?.performedOn || null,
            },
          },
          sources: [],
        },
      };
    }

    default:
      return {
        answerText: 'Unknown intent type.',
        data: { sources: [] },
      };
  }
}

