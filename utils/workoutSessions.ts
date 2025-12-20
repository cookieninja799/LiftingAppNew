// utils/workoutSessions.ts
// Extracted session merge logic from RecordWorkout.tsx for testability

import { IdFactory, ParsedExercise, defaultIdFactory } from './assistantParsing';

export type MuscleContribution = {
  muscleGroup: string;
  fraction: number;
  isDirect?: boolean;
};

export type Exercise = {
  id: string;
  exercise: string;
  sets: number;
  reps: number[];
  weights: string[];
  primaryMuscleGroup?: string;
  muscleContributions?: MuscleContribution[];
};

export type WorkoutSession = {
  id: string;
  date: string;
  exercises: Exercise[];
};

/**
 * Merges parsed exercises into existing workout sessions.
 * 
 * - If an exercise's date matches an existing session, appends the exercise to that session
 * - If no session exists for the date, creates a new session
 * 
 * @param existingSessions - Current array of workout sessions
 * @param parsedExercises - Array of parsed exercises to merge
 * @param options - Configuration options
 * @param options.sessionIdFactory - Factory function to generate session IDs
 * @returns Updated array of workout sessions
 */
export function mergeExercisesIntoSessions(
  existingSessions: WorkoutSession[],
  parsedExercises: ParsedExercise[],
  options: {
    sessionIdFactory?: IdFactory;
  } = {}
): WorkoutSession[] {
  const { sessionIdFactory = defaultIdFactory } = options;

  // Create a copy to avoid mutating the original
  const updatedSessions = existingSessions.map(session => ({
    ...session,
    exercises: [...session.exercises],
  }));

  parsedExercises.forEach(parsedResult => {
    const sessionDate = parsedResult.date;
    
    const newExercise: Exercise = {
      id: parsedResult.id,
      exercise: parsedResult.exercise,
      sets: parsedResult.sets,
      reps: parsedResult.reps || [],
      weights: parsedResult.weights || [],
      primaryMuscleGroup: parsedResult.primaryMuscleGroup,
      muscleContributions: parsedResult.muscleContributions,
    };

    const existingSessionIndex = updatedSessions.findIndex(
      session => session.date === sessionDate
    );

    if (existingSessionIndex !== -1) {
      // Append to existing session
      updatedSessions[existingSessionIndex].exercises.push(newExercise);
    } else {
      // Create new session
      updatedSessions.push({
        id: sessionIdFactory(),
        date: sessionDate,
        exercises: [newExercise],
      });
    }
  });

  return updatedSessions;
}

/**
 * Sorts sessions by date in descending order (most recent first)
 */
export function sortSessionsByDateDesc(sessions: WorkoutSession[]): WorkoutSession[] {
  return [...sessions].sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}
