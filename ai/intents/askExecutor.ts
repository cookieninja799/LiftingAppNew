// ai/intents/askExecutor.ts
// Deterministic executor for Ask mode intents

import { calculateStatsFromSessions } from '@/utils/analytics/calculateStats';
import { computeVolumeForExercise, getWeekFromDate } from '@/utils/helpers';
import { calculatePRMetrics } from '@/utils/pr/calculatePRMetrics';
import { WorkoutExercise, WorkoutSession } from '@/utils/workoutSessions';
import { AskIntent } from './askSchema';
import {
  EXERCISE_ALTERNATIVES,
  MUSCLE_GROUP_EXERCISES,
  calculateE1RM,
  calculateSimilarity,
  findBestMatch,
  findMatchingExercises,
  getAllExerciseNames,
  normalizeExerciseName,
  resolveExerciseAlias,
} from './askUtils';

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
    progressData?: {
      sessionCount: number;
      firstSession: {
        date: string;
        topWeight: number;
        topReps: number;
        totalVolume: number;
        sets: number;
      };
      lastSession: {
        date: string;
        topWeight: number;
        topReps: number;
        totalVolume: number;
        sets: number;
      };
      weightChange: number;
      weightChangePercent: number;
      e1rmChange: number;
      e1rmChangePercent: number;
      trend: 'improving' | 'declining' | 'stable';
    };
    _needsLLMResponse?: boolean;
    _llmContext?: Record<string, any>;
  };
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
        allUserExercises.some((userEx: string) =>
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

