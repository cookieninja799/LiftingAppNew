// utils/workoutSessions.ts
// Normalized session model for Phase 0-1 (Supabase + sync)

import { IdFactory, ParsedExercise, defaultIdFactory } from './assistantParsing';

export type MuscleContribution = {
  muscleGroup: string;
  fraction: number;
  isDirect?: boolean;
};

export type WorkoutSet = {
  id: string;
  exerciseId: string;
  setIndex: number;
  reps: number;
  weightText: string;
  weightKg?: number;
  isBodyweight: boolean;
  updatedAt: string;
  createdAt: string;
};

export type WorkoutExercise = {
  id: string;
  sessionId: string;
  nameRaw: string;
  nameCanonical?: string;
  primaryMuscleGroup?: string;
  muscleContributions?: MuscleContribution[];
  sets: WorkoutSet[];
  updatedAt: string;
  createdAt: string;
};

// Alias for backward compatibility during migration if needed
export type Exercise = WorkoutExercise;

export type WorkoutSession = {
  id: string;
  userId?: string;
  performedOn: string; // ISO date or YYYY-MM-DD
  title?: string;
  notes?: string;
  source?: string;
  exercises: WorkoutExercise[];
  updatedAt: string;
  createdAt: string;
  deletedAt?: string | null;
};

/**
 * Merges parsed exercises into existing workout sessions.
 * Converts flat ParsedExercise into normalized v1 structure.
 */
export function mergeExercisesIntoSessions(
  existingSessions: WorkoutSession[],
  parsedExercises: ParsedExercise[],
  options: {
    sessionIdFactory?: IdFactory;
    exerciseIdFactory?: IdFactory;
    setIdFactory?: IdFactory;
  } = {}
): WorkoutSession[] {
  const { 
    sessionIdFactory = defaultIdFactory,
    exerciseIdFactory = defaultIdFactory,
    setIdFactory = defaultIdFactory
  } = options;

  const now = new Date().toISOString();

  // Create a copy to avoid mutating the original
  const updatedSessions = existingSessions.map(session => ({
    ...session,
    exercises: [...session.exercises],
  }));

  parsedExercises.forEach(parsedResult => {
    const sessionDate = parsedResult.date;
    
    const existingSessionIndex = updatedSessions.findIndex(
      session => session.performedOn === sessionDate || session.performedOn.startsWith(sessionDate)
    );

    let session: WorkoutSession;
    if (existingSessionIndex !== -1) {
      session = updatedSessions[existingSessionIndex];
    } else {
      session = {
        id: sessionIdFactory(),
        performedOn: sessionDate,
        exercises: [],
        updatedAt: now,
        createdAt: now,
        deletedAt: null,
        source: 'ai_parsing'
      };
      updatedSessions.push(session);
    }

    const exerciseId = exerciseIdFactory();
    const newExercise: WorkoutExercise = {
      id: exerciseId,
      sessionId: session.id,
      nameRaw: parsedResult.exercise,
      primaryMuscleGroup: parsedResult.primaryMuscleGroup,
      muscleContributions: parsedResult.muscleContributions,
      sets: [],
      updatedAt: now,
      createdAt: now,
    };

    // Normalize sets
    const reps = parsedResult.reps || [];
    const weights = parsedResult.weights || [];
    const setCount = Math.max(reps.length, weights.length, parsedResult.sets || 0);

    for (let i = 0; i < setCount; i++) {
      newExercise.sets.push({
        id: setIdFactory(),
        exerciseId: exerciseId,
        setIndex: i,
        reps: reps[i] || 0,
        weightText: weights[i] || '0',
        isBodyweight: false, // Default
        updatedAt: now,
        createdAt: now,
      });
    }

    session.exercises.push(newExercise);
    session.updatedAt = now;
  });

  return updatedSessions;
}

/**
 * Sorts sessions by date in descending order (most recent first)
 */
export function sortSessionsByDateDesc(sessions: WorkoutSession[]): WorkoutSession[] {
  return [...sessions].sort((a, b) => 
    new Date(b.performedOn).getTime() - new Date(a.performedOn).getTime()
  );
}
