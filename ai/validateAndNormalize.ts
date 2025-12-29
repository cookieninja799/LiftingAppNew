// ai/validateAndNormalize.ts
// Validates and normalizes parsed exercise data

import { ParsedExercise } from '@/utils/assistantParsing';
import { getDefaultMuscleContributions } from '@/utils/analytics/muscleContributions';

export type Confidence = 'high' | 'low';

export interface ValidationResult {
  success: boolean;
  exercises?: ParsedExercise[];
  warnings: string[];
  confidence: Confidence;
  normalizedJson?: unknown;
}

export interface RawParsedExercise {
  id?: string;
  exercise?: string;
  nameRaw?: string;
  sets?: number;
  reps?: number[] | null;
  weights?: Array<string | number> | null;
  date?: string | null;
  primaryMuscleGroup?: string | null;
  muscleContributions?: Array<{
    muscleGroup?: string;
    fraction?: number;
    isDirect?: boolean;
  }> | null;
}

/**
 * Validates and normalizes parsed exercise data
 */
export function validateAndNormalize(
  extractedJson: unknown,
  options: {
    useTemplateMuscles?: boolean;
    allowModelProvidedMuscles?: boolean;
    dateFactory?: () => string;
    idFactory?: () => string;
  } = {}
): ValidationResult {
  const {
    useTemplateMuscles = true,
    allowModelProvidedMuscles = false,
    dateFactory = () => {
      const today = new Date();
      return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    },
    idFactory = () => `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
  } = options;

  const warnings: string[] = [];
  const exercises: ParsedExercise[] = [];
  let dateDefaulted = false;
  const usedIds = new Set<string>();

  // Extract exercises array from various JSON structures
  let rawExercises: RawParsedExercise[] = [];

  if (Array.isArray(extractedJson)) {
    rawExercises = extractedJson;
  } else if (extractedJson && typeof extractedJson === 'object' && 'exercises' in extractedJson) {
    const ex = (extractedJson as any).exercises;
    if (Array.isArray(ex)) {
      rawExercises = ex;
    }
  } else if (extractedJson && typeof extractedJson === 'object') {
    // Single exercise object
    rawExercises = [extractedJson as RawParsedExercise];
  }

  if (rawExercises.length === 0) {
    return {
      success: false,
      warnings: ['No exercises found in parsed data'],
      confidence: 'low',
    };
  }

  const defaultDate = dateFactory();

  // Normalize each exercise
  for (const raw of rawExercises) {
    const exerciseName = raw.exercise || raw.nameRaw || 'Unknown Exercise';
    const sets = typeof raw.sets === 'number' && raw.sets > 0 ? raw.sets : 1;
    const repsProvided = Array.isArray(raw.reps) ? raw.reps : null;
    const weightsProvided = Array.isArray(raw.weights) ? raw.weights : null;

    // Normalize date
    let date = typeof raw.date === 'string' ? raw.date : defaultDate;
    if (!raw.date) {
      dateDefaulted = true;
    }
    // Validate date format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      date = defaultDate;
      dateDefaulted = true;
      warnings.push(`Invalid date format for "${exerciseName}", defaulted to today`);
    }

    // Normalize reps and weights arrays:
    // - If absent, keep null (per strict schema)
    // - If present, ensure length === sets (pad with 0/"0" as needed)
    let normalizedReps: number[] | null = null;
    let normalizedWeights: string[] | null = null;

    if (repsProvided) {
      normalizedReps = [];
      for (let i = 0; i < sets; i++) {
        const rep = repsProvided[i];
        normalizedReps.push(typeof rep === 'number' && rep >= 0 ? rep : 0);
      }
    }

    if (weightsProvided) {
      normalizedWeights = [];
      for (let i = 0; i < sets; i++) {
        const weight = weightsProvided[i];
        if (typeof weight === 'string') {
          normalizedWeights.push(weight);
        } else if (typeof weight === 'number') {
          normalizedWeights.push(String(weight));
        } else {
          normalizedWeights.push('0');
        }
      }
    }

    // Handle muscle groups
    let primaryMuscleGroup: string | undefined;
    let muscleContributions: ParsedExercise['muscleContributions'];

    if (useTemplateMuscles) {
      // Use template muscles (recommended)
      const templateContributions = getDefaultMuscleContributions(
        exerciseName,
        typeof raw.primaryMuscleGroup === 'string' ? raw.primaryMuscleGroup : undefined
      );
      if (templateContributions && templateContributions.length > 0) {
        primaryMuscleGroup = templateContributions[0].muscleGroup;
        muscleContributions = templateContributions;
      }
    } else if (allowModelProvidedMuscles && raw.muscleContributions) {
      // Allow model-provided muscles (advanced)
      const sanitized = sanitizeMuscleContributions(raw.muscleContributions);
      if (sanitized && sanitized.length > 0) {
        primaryMuscleGroup =
          (typeof raw.primaryMuscleGroup === 'string' && raw.primaryMuscleGroup) || sanitized[0].muscleGroup;
        muscleContributions = sanitized;
      }
    }

    // Prefer model-provided deterministic id when valid; otherwise generate.
    const candidateId = typeof raw.id === 'string' ? raw.id : '';
    const isValidDeterministicId = /^(\d{4}-\d{2}-\d{2}|null)-\d+$/.test(candidateId);
    let id = isValidDeterministicId ? candidateId : idFactory();
    if (usedIds.has(id)) {
      id = idFactory();
    }
    usedIds.add(id);

    exercises.push({
      id,
      date,
      exercise: exerciseName,
      sets,
      reps: normalizedReps,
      weights: normalizedWeights,
      primaryMuscleGroup,
      muscleContributions,
    });
  }

  if (dateDefaulted) {
    warnings.push('No date provided; defaulted to today.');
  }

  // Calculate confidence
  const confidence = calculateConfidence(exercises, warnings);

  return {
    success: true,
    exercises,
    warnings,
    confidence,
    normalizedJson: exercises,
  };
}

/**
 * Sanitizes muscle contributions from model
 */
function sanitizeMuscleContributions(
  contributions: Array<{ muscleGroup?: string; fraction?: number; isDirect?: boolean }>
): ParsedExercise['muscleContributions'] {
  const ALLOWED_MUSCLE_GROUPS = new Set(['Chest', 'Back', 'Shoulders', 'Arms', 'Quads', 'Hamstrings']);

  const sanitized = contributions
    .filter((c) => {
      const group = c.muscleGroup;
      return typeof group === 'string' && ALLOWED_MUSCLE_GROUPS.has(group);
    })
    .map((c) => ({
      muscleGroup: c.muscleGroup!,
      fraction: typeof c.fraction === 'number' && c.fraction > 0 && c.fraction <= 1 ? c.fraction : 1,
      isDirect: c.isDirect === true ? true : undefined,
    }));

  return sanitized.length > 0 ? sanitized : undefined;
}

/**
 * Calculates confidence score based on heuristics
 */
function calculateConfidence(exercises: ParsedExercise[], warnings: string[]): Confidence {
  // Low confidence if:
  // - Many repairs applied (warnings about repairs)
  // - Many zeros in reps/weights
  // - Too few exercises for multi-line input (heuristic: if input seems long but only 1 exercise)

  let zeroCount = 0;
  let totalValues = 0;

  for (const ex of exercises) {
    if (Array.isArray(ex.reps)) {
      for (const rep of ex.reps) {
        totalValues++;
        if (rep === 0) zeroCount++;
      }
    }
    if (Array.isArray(ex.weights)) {
      for (const weight of ex.weights) {
        totalValues++;
        if (weight === '0' || weight === '') zeroCount++;
      }
    }
  }

  const zeroRatio = totalValues > 0 ? zeroCount / totalValues : 0;

  // Low confidence thresholds
  if (zeroRatio > 0.5) {
    return 'low'; // More than 50% zeros
  }

  if (warnings.length > 2) {
    return 'low'; // Many warnings
  }

  if (exercises.length === 1 && totalValues < 3) {
    return 'low'; // Single exercise with very few sets
  }

  return 'high';
}

