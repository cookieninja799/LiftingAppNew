import { WorkoutExercise, WorkoutSession } from '@/utils/workoutSessions';

/**
 * Exercise alternatives database
 * Maps exercises to their alternatives with similar muscle targets
 */
export const EXERCISE_ALTERNATIVES: Record<string, string[]> = {
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
export const MUSCLE_GROUP_EXERCISES: Record<string, string[]> = {
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
export const EXERCISE_ALIASES: Record<string, string[]> = {
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
export function normalizeExerciseName(name: string): string {
  return name.toLowerCase().replace(/[^\w\s]/g, '').trim();
}

/**
 * Calculates similarity score between two strings (0-1)
 * Uses a combination of substring matching and word overlap
 */
export function calculateSimilarity(query: string, target: string): number {
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
export function resolveExerciseAlias(query: string): string | null {
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
export function getAllExerciseNames(sessions: WorkoutSession[]): string[] {
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
export function findBestMatch(query: string, sessions: WorkoutSession[]): {
  match: string | null;
  score: number;
  suggestions: string[];
} {
  const allExercises = getAllExerciseNames(sessions);
  const normalizedQuery = normalizeExerciseName(query);

  // First, try to resolve via alias
  const aliasMatch = resolveExerciseAlias(query);
  if (aliasMatch) {
    // Find an exercise in history that matches the canonical name exactly
    // If alias resolves but canonical exercise isn't in history, don't fall back to similarity
    for (const exName of allExercises) {
      const normalizedEx = normalizeExerciseName(exName);
      if (normalizedEx === aliasMatch) {
        return { match: exName, score: 1.0, suggestions: [] };
      }
    }
    // Alias resolved but canonical exercise not found - return null with suggestions
    const scored = allExercises.map(exName => ({
      name: exName,
      score: calculateSimilarity(query, exName),
    })).sort((a, b) => b.score - a.score);
    return {
      match: null,
      score: 0,
      suggestions: scored.slice(0, 3).map(s => s.name),
    };
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
export function findMatchingExercises(exerciseName: string, sessions: WorkoutSession[]): {
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
export function calculateE1RM(weight: number, reps: number): number {
  if (reps === 0) return 0;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}
