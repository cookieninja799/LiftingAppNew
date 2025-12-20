// utils/data/workoutBackup.ts
// Backup format and validation for workout data export/import

import { Exercise, WorkoutSession } from '../workoutSessions';

/**
 * Backup file format (version 1)
 */
export interface WorkoutBackupV1 {
  schemaVersion: 1;
  exportedAt: string; // ISO8601 timestamp
  workoutSessions: WorkoutSession[];
}

/**
 * Creates a backup object from workout sessions
 */
export function createWorkoutBackup(sessions: WorkoutSession[]): WorkoutBackupV1 {
  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    workoutSessions: sessions,
  };
}

/**
 * Converts a backup object to JSON string
 */
export function stringifyWorkoutBackup(backup: WorkoutBackupV1): string {
  return JSON.stringify(backup, null, 2);
}

/**
 * Validation error for backup parsing
 */
export class BackupValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupValidationError';
  }
}

/**
 * Validates and normalizes a parsed backup object
 */
function validateAndNormalizeBackup(data: any): WorkoutBackupV1 {
  // Check root object structure
  if (!data || typeof data !== 'object') {
    throw new BackupValidationError('Backup file must be a JSON object');
  }

  // Check schemaVersion
  if (data.schemaVersion !== 1) {
    throw new BackupValidationError(
      `Unsupported backup schema version: ${data.schemaVersion}. Expected version 1.`
    );
  }

  // Check exportedAt
  if (!data.exportedAt || typeof data.exportedAt !== 'string') {
    throw new BackupValidationError('Backup file missing or invalid "exportedAt" field');
  }

  // Check workoutSessions array
  if (!Array.isArray(data.workoutSessions)) {
    throw new BackupValidationError('Backup file must contain "workoutSessions" as an array');
  }

  // Validate and normalize each session
  const normalizedSessions: WorkoutSession[] = data.workoutSessions.map(
    (session: any, index: number) => {
      if (!session || typeof session !== 'object') {
        throw new BackupValidationError(`Session at index ${index} must be an object`);
      }

      // Validate required session fields
      if (!session.id || typeof session.id !== 'string') {
        throw new BackupValidationError(`Session at index ${index} missing or invalid "id" field`);
      }

      if (!session.date || typeof session.date !== 'string') {
        throw new BackupValidationError(`Session at index ${index} missing or invalid "date" field`);
      }

      // Validate date format (basic check for YYYY-MM-DD)
      if (!/^\d{4}-\d{2}-\d{2}/.test(session.date)) {
        throw new BackupValidationError(
          `Session at index ${index} has invalid date format. Expected YYYY-MM-DD format.`
        );
      }

      if (!Array.isArray(session.exercises)) {
        throw new BackupValidationError(
          `Session at index ${index} must have "exercises" as an array`
        );
      }

      // Validate and normalize each exercise
      const normalizedExercises: Exercise[] = session.exercises.map(
        (exercise: any, exIndex: number) => {
          if (!exercise || typeof exercise !== 'object') {
            throw new BackupValidationError(
              `Exercise at session ${index}, exercise ${exIndex} must be an object`
            );
          }

          // Validate required exercise fields
          if (!exercise.id || typeof exercise.id !== 'string') {
            throw new BackupValidationError(
              `Exercise at session ${index}, exercise ${exIndex} missing or invalid "id" field`
            );
          }

          if (!exercise.exercise || typeof exercise.exercise !== 'string') {
            throw new BackupValidationError(
              `Exercise at session ${index}, exercise ${exIndex} missing or invalid "exercise" field`
            );
          }

          if (typeof exercise.sets !== 'number' || exercise.sets < 0) {
            throw new BackupValidationError(
              `Exercise at session ${index}, exercise ${exIndex} missing or invalid "sets" field`
            );
          }

          if (!Array.isArray(exercise.reps)) {
            throw new BackupValidationError(
              `Exercise at session ${index}, exercise ${exIndex} must have "reps" as an array`
            );
          }

          if (!Array.isArray(exercise.weights)) {
            throw new BackupValidationError(
              `Exercise at session ${index}, exercise ${exIndex} must have "weights" as an array`
            );
          }

          // Normalize optional fields
          return {
            id: exercise.id,
            exercise: exercise.exercise,
            sets: exercise.sets,
            reps: exercise.reps,
            weights: exercise.weights,
            primaryMuscleGroup: exercise.primaryMuscleGroup || undefined,
            muscleContributions: Array.isArray(exercise.muscleContributions) 
              ? exercise.muscleContributions 
              : undefined,
          };
        }
      );

      return {
        id: session.id,
        date: session.date,
        exercises: normalizedExercises,
      };
    }
  );

  return {
    schemaVersion: 1,
    exportedAt: data.exportedAt,
    workoutSessions: normalizedSessions,
  };
}

/**
 * Parses a JSON string into a validated backup object
 * @param json - JSON string to parse
 * @returns Validated and normalized backup object
 * @throws BackupValidationError if validation fails
 */
export function parseWorkoutBackup(json: string): WorkoutBackupV1 {
  try {
    const data = JSON.parse(json);
    return validateAndNormalizeBackup(data);
  } catch (error) {
    if (error instanceof BackupValidationError) {
      throw error;
    }
    // JSON parse error
    throw new BackupValidationError(
      `Invalid JSON format: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
