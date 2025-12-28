// utils/data/workoutBackup.ts
// Backup format and validation for workout data export/import

import { WorkoutSession, WorkoutExercise, WorkoutSet } from '../workoutSessions';

/**
 * Backup file format (version 2)
 */
export interface WorkoutBackupV2 {
  schemaVersion: 2;
  exportedAt: string; // ISO8601 timestamp
  workoutSessions: WorkoutSession[];
}

/**
 * Creates a backup object from workout sessions
 */
export function createWorkoutBackup(sessions: WorkoutSession[]): WorkoutBackupV2 {
  return {
    schemaVersion: 2,
    exportedAt: new Date().toISOString(),
    workoutSessions: sessions,
  };
}

/**
 * Converts a backup object to JSON string
 */
export function stringifyWorkoutBackup(backup: WorkoutBackupV2): string {
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
function validateAndNormalizeBackup(data: any): WorkoutBackupV2 {
  if (!data || typeof data !== 'object') {
    throw new BackupValidationError('Backup file must be a JSON object');
  }

  // Handle v1 to v2 migration during import if needed
  if (data.schemaVersion === 1) {
    // Basic conversion logic could be added here if we wanted to support importing v1 backups directly
    // For now, let's assume we want v2
    throw new BackupValidationError('Legacy backup version 1 not supported in this version. Please migrate your data first.');
  }

  if (data.schemaVersion !== 2) {
    throw new BackupValidationError(`Unsupported backup schema version: ${data.schemaVersion}. Expected version 2.`);
  }

  if (!Array.isArray(data.workoutSessions)) {
    throw new BackupValidationError('Backup file must contain "workoutSessions" as an array');
  }

  // Basic structure check for v2 sessions
  data.workoutSessions.forEach((session: any, index: number) => {
    if (!session.id || !session.performedOn || !Array.isArray(session.exercises)) {
      throw new BackupValidationError(`Session at index ${index} is invalid for schema version 2`);
    }
  });

  return {
    schemaVersion: 2,
    exportedAt: data.exportedAt || new Date().toISOString(),
    workoutSessions: data.workoutSessions,
  };
}

/**
 * Parses a JSON string into a validated backup object
 */
export function parseWorkoutBackup(json: string): WorkoutBackupV2 {
  try {
    const data = JSON.parse(json);
    return validateAndNormalizeBackup(data);
  } catch (error) {
    if (error instanceof BackupValidationError) {
      throw error;
    }
    throw new BackupValidationError(`Invalid JSON format: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

