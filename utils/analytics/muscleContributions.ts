// utils/analytics/muscleContributions.ts
// Deterministic muscle contribution templates for fractional set counting

import { WorkoutExercise, MuscleContribution } from '../workoutSessions';

const ALLOWED_MUSCLE_GROUPS = new Set([
  'Chest',
  'Back',
  'Shoulders',
  'Arms',
  'Quads',
  'Hamstrings',
]);

function clampFraction(n: unknown): number | null {
  if (typeof n !== 'number' || !Number.isFinite(n)) return null;
  if (n <= 0) return null;
  if (n >= 1) return 1;
  return n;
}

/**
 * Sanitizes / normalizes provided muscle contributions:
 * - Filters to allowed muscle groups only
 * - Clamps fractions to (0, 1]
 * - Dedupes by muscleGroup (keeps max fraction; merges isDirect)
 * - If primaryMuscleGroup is present, ensures it exists with fraction=1 and isDirect=true
 */
function normalizeProvidedContributions(
  provided: MuscleContribution[] | undefined,
  primaryMuscleGroup?: string
): MuscleContribution[] | undefined {
  if (!provided || provided.length === 0) return undefined;

  const byGroup = new Map<string, MuscleContribution>();

  for (const c of provided) {
    const muscleGroup = c?.muscleGroup;
    if (typeof muscleGroup !== 'string' || !ALLOWED_MUSCLE_GROUPS.has(muscleGroup)) continue;

    const fraction = clampFraction((c as any).fraction);
    if (fraction === null) continue;

    const prev = byGroup.get(muscleGroup);
    if (!prev) {
      byGroup.set(muscleGroup, {
        muscleGroup,
        fraction,
        isDirect: c?.isDirect === true ? true : undefined,
      });
      continue;
    }

    byGroup.set(muscleGroup, {
      muscleGroup,
      fraction: Math.max(prev.fraction, fraction),
      isDirect: prev.isDirect === true || c?.isDirect === true ? true : undefined,
    });
  }

  // Ensure primary muscle group is always treated as direct with fraction=1.0
  if (primaryMuscleGroup && ALLOWED_MUSCLE_GROUPS.has(primaryMuscleGroup)) {
    byGroup.set(primaryMuscleGroup, {
      muscleGroup: primaryMuscleGroup,
      fraction: 1,
      isDirect: true,
    });
  }

  const normalized = Array.from(byGroup.values());
  return normalized.length > 0 ? normalized : undefined;
}

/**
 * Template dictionary for common exercises.
 * Maps normalized exercise names to their muscle contributions.
 * 
 * Rules:
 * - Primary muscle gets fraction: 1, isDirect: true
 * - Secondary muscles get fractional contributions (0.25-0.5)
 */
const EXERCISE_TEMPLATES: Record<string, MuscleContribution[]> = {
  // Chest-focused pressing movements
  'bench press': [
    { muscleGroup: 'Chest', fraction: 1, isDirect: true },
    { muscleGroup: 'Arms', fraction: 0.5 },
    { muscleGroup: 'Shoulders', fraction: 0.5 },
  ],
  'db bench press': [
    { muscleGroup: 'Chest', fraction: 1, isDirect: true },
    { muscleGroup: 'Arms', fraction: 0.5 },
    { muscleGroup: 'Shoulders', fraction: 0.5 },
  ],
  'dumbbell bench press': [
    { muscleGroup: 'Chest', fraction: 1, isDirect: true },
    { muscleGroup: 'Arms', fraction: 0.5 },
    { muscleGroup: 'Shoulders', fraction: 0.5 },
  ],
  'incline bench press': [
    { muscleGroup: 'Chest', fraction: 1, isDirect: true },
    { muscleGroup: 'Arms', fraction: 0.5 },
    { muscleGroup: 'Shoulders', fraction: 0.5 },
  ],
  'incline press': [
    { muscleGroup: 'Chest', fraction: 1, isDirect: true },
    { muscleGroup: 'Arms', fraction: 0.5 },
    { muscleGroup: 'Shoulders', fraction: 0.5 },
  ],
  'incline dumbbell press': [
    { muscleGroup: 'Chest', fraction: 1, isDirect: true },
    { muscleGroup: 'Arms', fraction: 0.5 },
    { muscleGroup: 'Shoulders', fraction: 0.5 },
  ],
  'decline bench press': [
    { muscleGroup: 'Chest', fraction: 1, isDirect: true },
    { muscleGroup: 'Arms', fraction: 0.5 },
    { muscleGroup: 'Shoulders', fraction: 0.25 },
  ],
  'chest press': [
    { muscleGroup: 'Chest', fraction: 1, isDirect: true },
    { muscleGroup: 'Arms', fraction: 0.5 },
    { muscleGroup: 'Shoulders', fraction: 0.5 },
  ],

  // Shoulder-focused pressing movements
  'overhead press': [
    { muscleGroup: 'Shoulders', fraction: 1, isDirect: true },
    { muscleGroup: 'Arms', fraction: 0.5 },
    { muscleGroup: 'Chest', fraction: 0.25 },
  ],
  'ohp': [
    { muscleGroup: 'Shoulders', fraction: 1, isDirect: true },
    { muscleGroup: 'Arms', fraction: 0.5 },
    { muscleGroup: 'Chest', fraction: 0.25 },
  ],
  'shoulder press': [
    { muscleGroup: 'Shoulders', fraction: 1, isDirect: true },
    { muscleGroup: 'Arms', fraction: 0.5 },
    { muscleGroup: 'Chest', fraction: 0.25 },
  ],
  'military press': [
    { muscleGroup: 'Shoulders', fraction: 1, isDirect: true },
    { muscleGroup: 'Arms', fraction: 0.5 },
    { muscleGroup: 'Chest', fraction: 0.25 },
  ],
  'dumbbell shoulder press': [
    { muscleGroup: 'Shoulders', fraction: 1, isDirect: true },
    { muscleGroup: 'Arms', fraction: 0.5 },
    { muscleGroup: 'Chest', fraction: 0.25 },
  ],

  // Back-focused pulling movements
  'row': [
    { muscleGroup: 'Back', fraction: 1, isDirect: true },
    { muscleGroup: 'Arms', fraction: 0.5 },
    { muscleGroup: 'Shoulders', fraction: 0.5 },
  ],
  'barbell row': [
    { muscleGroup: 'Back', fraction: 1, isDirect: true },
    { muscleGroup: 'Arms', fraction: 0.5 },
    { muscleGroup: 'Shoulders', fraction: 0.5 },
  ],
  'bent over row': [
    { muscleGroup: 'Back', fraction: 1, isDirect: true },
    { muscleGroup: 'Arms', fraction: 0.5 },
    { muscleGroup: 'Shoulders', fraction: 0.5 },
  ],
  'dumbbell row': [
    { muscleGroup: 'Back', fraction: 1, isDirect: true },
    { muscleGroup: 'Arms', fraction: 0.5 },
    { muscleGroup: 'Shoulders', fraction: 0.5 },
  ],
  'cable row': [
    { muscleGroup: 'Back', fraction: 1, isDirect: true },
    { muscleGroup: 'Arms', fraction: 0.5 },
    { muscleGroup: 'Shoulders', fraction: 0.5 },
  ],
  'seated row': [
    { muscleGroup: 'Back', fraction: 1, isDirect: true },
    { muscleGroup: 'Arms', fraction: 0.5 },
    { muscleGroup: 'Shoulders', fraction: 0.5 },
  ],
  'pulldown': [
    { muscleGroup: 'Back', fraction: 1, isDirect: true },
    { muscleGroup: 'Arms', fraction: 0.5 },
    { muscleGroup: 'Shoulders', fraction: 0.5 },
  ],
  'lat pulldown': [
    { muscleGroup: 'Back', fraction: 1, isDirect: true },
    { muscleGroup: 'Arms', fraction: 0.5 },
    { muscleGroup: 'Shoulders', fraction: 0.5 },
  ],
  'pull up': [
    { muscleGroup: 'Back', fraction: 1, isDirect: true },
    { muscleGroup: 'Arms', fraction: 0.5 },
    { muscleGroup: 'Shoulders', fraction: 0.5 },
  ],
  'pull-up': [
    { muscleGroup: 'Back', fraction: 1, isDirect: true },
    { muscleGroup: 'Arms', fraction: 0.5 },
    { muscleGroup: 'Shoulders', fraction: 0.5 },
  ],
  'pullup': [
    { muscleGroup: 'Back', fraction: 1, isDirect: true },
    { muscleGroup: 'Arms', fraction: 0.5 },
    { muscleGroup: 'Shoulders', fraction: 0.5 },
  ],
  'chin up': [
    { muscleGroup: 'Back', fraction: 1, isDirect: true },
    { muscleGroup: 'Arms', fraction: 0.5 },
    { muscleGroup: 'Shoulders', fraction: 0.5 },
  ],
  'chin-up': [
    { muscleGroup: 'Back', fraction: 1, isDirect: true },
    { muscleGroup: 'Arms', fraction: 0.5 },
    { muscleGroup: 'Shoulders', fraction: 0.5 },
  ],
  'chinup': [
    { muscleGroup: 'Back', fraction: 1, isDirect: true },
    { muscleGroup: 'Arms', fraction: 0.5 },
    { muscleGroup: 'Shoulders', fraction: 0.5 },
  ],
  'deadlift': [
    { muscleGroup: 'Back', fraction: 1, isDirect: true },
    { muscleGroup: 'Hamstrings', fraction: 0.5 },
    { muscleGroup: 'Quads', fraction: 0.25 },
  ],

  // Quad-focused leg movements
  'squat': [
    { muscleGroup: 'Quads', fraction: 1, isDirect: true },
    { muscleGroup: 'Hamstrings', fraction: 0.25 },
  ],
  'squats': [
    { muscleGroup: 'Quads', fraction: 1, isDirect: true },
    { muscleGroup: 'Hamstrings', fraction: 0.25 },
  ],
  'back squat': [
    { muscleGroup: 'Quads', fraction: 1, isDirect: true },
    { muscleGroup: 'Hamstrings', fraction: 0.25 },
  ],
  'front squat': [
    { muscleGroup: 'Quads', fraction: 1, isDirect: true },
    { muscleGroup: 'Hamstrings', fraction: 0.25 },
  ],
  'leg press': [
    { muscleGroup: 'Quads', fraction: 1, isDirect: true },
    { muscleGroup: 'Hamstrings', fraction: 0.25 },
  ],
  'leg extension': [
    { muscleGroup: 'Quads', fraction: 1, isDirect: true },
  ],
  'lunge': [
    { muscleGroup: 'Quads', fraction: 1, isDirect: true },
    { muscleGroup: 'Hamstrings', fraction: 0.5 },
  ],
  'lunges': [
    { muscleGroup: 'Quads', fraction: 1, isDirect: true },
    { muscleGroup: 'Hamstrings', fraction: 0.5 },
  ],

  // Hamstring-focused movements
  'rdl': [
    { muscleGroup: 'Hamstrings', fraction: 1, isDirect: true },
  ],
  'romanian deadlift': [
    { muscleGroup: 'Hamstrings', fraction: 1, isDirect: true },
  ],
  'leg curl': [
    { muscleGroup: 'Hamstrings', fraction: 1, isDirect: true },
  ],
  'hamstring curl': [
    { muscleGroup: 'Hamstrings', fraction: 1, isDirect: true },
  ],
  'stiff leg deadlift': [
    { muscleGroup: 'Hamstrings', fraction: 1, isDirect: true },
  ],
};

/**
 * Normalizes an exercise name for template lookup.
 * - Converts to lowercase
 * - Trims whitespace
 * - Removes punctuation
 * - Collapses multiple spaces
 */
function normalizeExerciseName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove punctuation except hyphens
    .replace(/\s+/g, ' '); // Collapse multiple spaces
}

/**
 * Gets default muscle contributions for an exercise based on templates.
 * Falls back to primary muscle group if no template match.
 * 
 * @param exerciseName - The name of the exercise
 * @param primary - Optional primary muscle group (fallback)
 * @returns Array of muscle contributions or undefined
 */
export function getDefaultMuscleContributions(
  exerciseName: string,
  primary?: string
): MuscleContribution[] | undefined {
  const normalized = normalizeExerciseName(exerciseName);
  
  // Check for exact template match
  if (EXERCISE_TEMPLATES[normalized]) {
    return EXERCISE_TEMPLATES[normalized];
  }
  
  // Check for partial matches (e.g., "incline dumbbell bench press" contains "bench press")
  for (const [templateName, contributions] of Object.entries(EXERCISE_TEMPLATES)) {
    if (normalized.includes(templateName) || templateName.includes(normalized)) {
      return contributions;
    }
  }
  
  // Fallback: if primary muscle group exists, return it as direct 1.0
  if (primary) {
    return [{ muscleGroup: primary, fraction: 1, isDirect: true }];
  }
  
  // No template match and no primary muscle group
  return undefined;
}

/**
 * Ensures an exercise has muscle contributions.
 * If muscleContributions exists and is non-empty, returns it.
 * Otherwise, attempts to derive from templates or primary muscle group.
 * 
 * @param ex - The exercise to get contributions for
 * @returns Array of muscle contributions or undefined
 */
export function ensureMuscleContributions(
  ex: WorkoutExercise
): MuscleContribution[] | undefined {
  // Prefer explicit muscleContributions when present, but sanitize and
  // enforce "primary muscle group is direct (fraction=1.0)" for consistency.
  const normalizedProvided = normalizeProvidedContributions(
    ex.muscleContributions,
    ex.primaryMuscleGroup
  );
  if (normalizedProvided && normalizedProvided.length > 0) {
    return normalizedProvided;
  }

  // Otherwise, derive from templates or primary muscle group
  return getDefaultMuscleContributions(ex.nameRaw, ex.primaryMuscleGroup);
}
