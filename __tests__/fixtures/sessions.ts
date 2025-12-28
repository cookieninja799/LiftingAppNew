// __tests__/fixtures/sessions.ts
// Sample workout session data for testing (v1 normalized model)

import { WorkoutSession, WorkoutSet } from '../../utils/workoutSessions';

// Helper to create timestamps
const now = '2024-12-18T12:00:00.000Z';

// Helper to create sets from reps/weights arrays
function createSets(exerciseId: string, reps: number[], weights: string[], startIndex = 0): WorkoutSet[] {
  const setCount = Math.max(reps.length, weights.length);
  return Array.from({ length: setCount }, (_, i) => ({
    id: `set-${exerciseId}-${i}`,
    exerciseId,
    setIndex: i + startIndex,
    reps: reps[i] || 0,
    weightText: weights[i] || '0',
    isBodyweight: weights[i]?.toLowerCase().includes('bodyweight') || false,
    updatedAt: now,
    createdAt: now,
  }));
}

/**
 * Empty sessions array
 */
export const emptySessions: WorkoutSession[] = [];

/**
 * Single session with multiple exercises
 */
export const singleSession: WorkoutSession[] = [
  {
    id: 'session-1',
    performedOn: '2024-12-18',
    exercises: [
      {
        id: 'ex-1',
        sessionId: 'session-1',
        nameRaw: 'Bench Press',
        primaryMuscleGroup: 'Chest',
        sets: createSets('ex-1', [10, 8, 6], ['135', '155', '175']),
        updatedAt: now,
        createdAt: now,
      },
      {
        id: 'ex-2',
        sessionId: 'session-1',
        nameRaw: 'Incline Dumbbell Press',
        primaryMuscleGroup: 'Chest',
        sets: createSets('ex-2', [12, 10, 8], ['50', '55', '60']),
        updatedAt: now,
        createdAt: now,
      },
    ],
    updatedAt: now,
    createdAt: now,
    deletedAt: null,
  },
];

/**
 * Multiple sessions across different days and weeks
 */
export const multipleSessions: WorkoutSession[] = [
  {
    id: 'session-1',
    performedOn: '2024-12-18', // Week 51
    exercises: [
      {
        id: 'ex-1',
        sessionId: 'session-1',
        nameRaw: 'Bench Press',
        primaryMuscleGroup: 'Chest',
        sets: createSets('ex-1', [10, 8, 6], ['135', '155', '175']),
        updatedAt: now,
        createdAt: now,
      },
      {
        id: 'ex-2',
        sessionId: 'session-1',
        nameRaw: 'Squats',
        primaryMuscleGroup: 'Quads',
        sets: createSets('ex-2', [12, 10, 8, 6], ['185', '205', '225', '245']),
        updatedAt: now,
        createdAt: now,
      },
    ],
    updatedAt: now,
    createdAt: now,
    deletedAt: null,
  },
  {
    id: 'session-2',
    performedOn: '2024-12-17', // Week 51
    exercises: [
      {
        id: 'ex-3',
        sessionId: 'session-2',
        nameRaw: 'Deadlift',
        primaryMuscleGroup: 'Back',
        sets: createSets('ex-3', [5, 5, 5, 5, 5], ['315', '315', '315', '315', '315']),
        updatedAt: now,
        createdAt: now,
      },
      {
        id: 'ex-4',
        sessionId: 'session-2',
        nameRaw: 'Bench Press',
        primaryMuscleGroup: 'Chest',
        sets: createSets('ex-4', [8, 8, 8], ['155', '155', '155']),
        updatedAt: now,
        createdAt: now,
      },
    ],
    updatedAt: now,
    createdAt: now,
    deletedAt: null,
  },
  {
    id: 'session-3',
    performedOn: '2024-12-10', // Week 50
    exercises: [
      {
        id: 'ex-5',
        sessionId: 'session-3',
        nameRaw: 'Overhead Press',
        primaryMuscleGroup: 'Shoulders',
        sets: createSets('ex-5', [8, 8, 6, 6], ['95', '95', '105', '105']),
        updatedAt: now,
        createdAt: now,
      },
    ],
    updatedAt: now,
    createdAt: now,
    deletedAt: null,
  },
];

/**
 * Sessions for PR testing with varying weights and reps
 */
export const prTestSessions: WorkoutSession[] = [
  {
    id: 'session-1',
    performedOn: '2024-12-18',
    exercises: [
      {
        id: 'ex-1',
        sessionId: 'session-1',
        nameRaw: 'Bench Press',
        primaryMuscleGroup: 'Chest',
        sets: createSets('ex-1', [10, 8, 6], ['135', '155', '175']), // PR: 175 @ 6 reps
        updatedAt: now,
        createdAt: now,
      },
    ],
    updatedAt: now,
    createdAt: now,
    deletedAt: null,
  },
  {
    id: 'session-2',
    performedOn: '2024-12-15',
    exercises: [
      {
        id: 'ex-2',
        sessionId: 'session-2',
        nameRaw: 'Bench Press',
        primaryMuscleGroup: 'Chest',
        sets: createSets('ex-2', [5, 5, 3], ['185', '195', '205']), // PR candidate: 205 @ 3 reps (higher weight wins)
        updatedAt: now,
        createdAt: now,
      },
    ],
    updatedAt: now,
    createdAt: now,
    deletedAt: null,
  },
  {
    id: 'session-3',
    performedOn: '2024-12-12',
    exercises: [
      {
        id: 'ex-3',
        sessionId: 'session-3',
        nameRaw: 'Bench Press',
        primaryMuscleGroup: 'Chest',
        sets: createSets('ex-3', [4, 5], ['205', '205']), // PR: 205 @ 5 reps (same weight, more reps wins)
        updatedAt: now,
        createdAt: now,
      },
    ],
    updatedAt: now,
    createdAt: now,
    deletedAt: null,
  },
  {
    id: 'session-4',
    performedOn: '2024-12-10',
    exercises: [
      {
        id: 'ex-4',
        sessionId: 'session-4',
        nameRaw: 'Squats',
        primaryMuscleGroup: 'Quads',
        sets: createSets('ex-4', [3], ['315']), // Only squat PR: 315 @ 3 reps
        updatedAt: now,
        createdAt: now,
      },
    ],
    updatedAt: now,
    createdAt: now,
    deletedAt: null,
  },
];

/**
 * Sessions with bodyweight exercises
 */
export const bodyweightSessions: WorkoutSession[] = [
  {
    id: 'session-1',
    performedOn: '2024-12-18',
    exercises: [
      {
        id: 'ex-1',
        sessionId: 'session-1',
        nameRaw: 'Pull-ups',
        primaryMuscleGroup: 'Back',
        sets: createSets('ex-1', [10, 8, 6], ['bodyweight', 'bodyweight', 'bodyweight']),
        updatedAt: now,
        createdAt: now,
      },
      {
        id: 'ex-2',
        sessionId: 'session-1',
        nameRaw: 'Weighted Pull-ups',
        primaryMuscleGroup: 'Back',
        sets: createSets('ex-2', [8, 6, 5], ['25', '35', '45']), // Added weight on top of bodyweight
        updatedAt: now,
        createdAt: now,
      },
    ],
    updatedAt: now,
    createdAt: now,
    deletedAt: null,
  },
];

/**
 * Sessions with missing muscle groups (edge case)
 */
export const sessionsWithMissingMuscleGroup: WorkoutSession[] = [
  {
    id: 'session-1',
    performedOn: '2024-12-18',
    exercises: [
      {
        id: 'ex-1',
        sessionId: 'session-1',
        nameRaw: 'Mystery Exercise',
        sets: createSets('ex-1', [10, 10, 10], ['100', '100', '100']),
        // primaryMuscleGroup is missing/undefined
        updatedAt: now,
        createdAt: now,
      },
      {
        id: 'ex-2',
        sessionId: 'session-1',
        nameRaw: 'Bench Press',
        primaryMuscleGroup: 'Chest',
        sets: createSets('ex-2', [8, 8, 8], ['155', '155', '155']),
        updatedAt: now,
        createdAt: now,
      },
    ],
    updatedAt: now,
    createdAt: now,
    deletedAt: null,
  },
];

/**
 * Sessions spanning multiple weeks for weekly stats testing
 */
export const multiWeekSessions: WorkoutSession[] = [
  // Week 51 (Dec 16-22, 2024)
  {
    id: 'session-w51-1',
    performedOn: '2024-12-18',
    exercises: [
      {
        id: 'ex-1',
        sessionId: 'session-w51-1',
        nameRaw: 'Bench Press',
        primaryMuscleGroup: 'Chest',
        sets: createSets('ex-1', [10, 10, 8, 8], ['135', '145', '155', '155']),
        updatedAt: now,
        createdAt: now,
      },
    ],
    updatedAt: now,
    createdAt: now,
    deletedAt: null,
  },
  {
    id: 'session-w51-2',
    performedOn: '2024-12-20',
    exercises: [
      {
        id: 'ex-2',
        sessionId: 'session-w51-2',
        nameRaw: 'Incline Press',
        primaryMuscleGroup: 'Chest',
        sets: createSets('ex-2', [10, 10, 8], ['115', '125', '135']),
        updatedAt: now,
        createdAt: now,
      },
    ],
    updatedAt: now,
    createdAt: now,
    deletedAt: null,
  },
  // Week 50 (Dec 9-15, 2024)
  {
    id: 'session-w50-1',
    performedOn: '2024-12-11',
    exercises: [
      {
        id: 'ex-3',
        sessionId: 'session-w50-1',
        nameRaw: 'Bench Press',
        primaryMuscleGroup: 'Chest',
        sets: createSets('ex-3', [8, 8, 6], ['155', '165', '175']),
        updatedAt: now,
        createdAt: now,
      },
    ],
    updatedAt: now,
    createdAt: now,
    deletedAt: null,
  },
  // Week 49 (Dec 2-8, 2024)
  {
    id: 'session-w49-1',
    performedOn: '2024-12-04',
    exercises: [
      {
        id: 'ex-4',
        sessionId: 'session-w49-1',
        nameRaw: 'Squats',
        primaryMuscleGroup: 'Quads',
        sets: createSets('ex-4', [5, 5, 5, 5, 5], ['225', '225', '225', '225', '225']),
        updatedAt: now,
        createdAt: now,
      },
    ],
    updatedAt: now,
    createdAt: now,
    deletedAt: null,
  },
];

/**
 * Sessions for testing fractional set counting with template exercises
 */
export const fractionalSetsSessions: WorkoutSession[] = [
  {
    id: 'session-fractional-1',
    performedOn: '2024-12-18', // Week 51
    exercises: [
      {
        id: 'ex-bench-1',
        sessionId: 'session-fractional-1',
        nameRaw: 'Bench Press',
        primaryMuscleGroup: 'Chest',
        // Template: Chest 1.0 direct, Arms 0.5, Shoulders 0.5
        sets: createSets('ex-bench-1', [10, 8, 6], ['135', '155', '175']),
        updatedAt: now,
        createdAt: now,
      },
      {
        id: 'ex-row-1',
        sessionId: 'session-fractional-1',
        nameRaw: 'Barbell Row',
        primaryMuscleGroup: 'Back',
        // Template: Back 1.0 direct, Arms 0.5, Shoulders 0.5
        sets: createSets('ex-row-1', [12, 10, 8, 8], ['135', '145', '155', '155']),
        updatedAt: now,
        createdAt: now,
      },
      {
        id: 'ex-squat-1',
        sessionId: 'session-fractional-1',
        nameRaw: 'Squats',
        primaryMuscleGroup: 'Quads',
        // Template: Quads 1.0 direct, Hamstrings 0.25
        sets: createSets('ex-squat-1', [10, 8, 6, 6], ['185', '205', '225', '245']),
        updatedAt: now,
        createdAt: now,
      },
    ],
    updatedAt: now,
    createdAt: now,
    deletedAt: null,
  },
];

/**
 * Sessions with exercises that have no muscle group data at all (uncategorized)
 */
export const uncategorizedExercisesSessions: WorkoutSession[] = [
  {
    id: 'session-uncategorized-1',
    performedOn: '2024-12-18', // Week 51
    exercises: [
      {
        id: 'ex-mystery-1',
        sessionId: 'session-uncategorized-1',
        nameRaw: 'Mystery Machine', // No template match
        sets: createSets('ex-mystery-1', [10, 10, 10], ['100', '100', '100']),
        // No primaryMuscleGroup - should be uncategorized
        updatedAt: now,
        createdAt: now,
      },
      {
        id: 'ex-bench-2',
        sessionId: 'session-uncategorized-1',
        nameRaw: 'Bench Press',
        primaryMuscleGroup: 'Chest',
        sets: createSets('ex-bench-2', [10, 8, 6], ['135', '155', '175']),
        updatedAt: now,
        createdAt: now,
      },
    ],
    updatedAt: now,
    createdAt: now,
    deletedAt: null,
  },
];

/**
 * Sessions with explicit muscleContributions (server-provided)
 */
export const sessionsWithMuscleContributions: WorkoutSession[] = [
  {
    id: 'session-contrib-1',
    performedOn: '2024-12-18',
    exercises: [
      {
        id: 'ex-custom-1',
        sessionId: 'session-contrib-1',
        nameRaw: 'Custom Exercise',
        primaryMuscleGroup: 'Chest',
        muscleContributions: [
          { muscleGroup: 'Chest', fraction: 1, isDirect: true },
          { muscleGroup: 'Arms', fraction: 0.3 },
        ],
        sets: createSets('ex-custom-1', [10, 10, 10], ['100', '100', '100']),
        updatedAt: now,
        createdAt: now,
      },
    ],
    updatedAt: now,
    createdAt: now,
    deletedAt: null,
  },
];

/**
 * Get current week identifier for testing
 * Uses same logic as helpers.ts
 */
export function getTestCurrentWeek(): string {
  // Return a fixed week for deterministic tests
  return '2024-W51';
}
