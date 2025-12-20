// __tests__/fixtures/sessions.ts
// Sample workout session data for testing

import { WorkoutSession } from '../../utils/workoutSessions';

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
    date: '2024-12-18',
    exercises: [
      {
        id: 'ex-1',
        exercise: 'Bench Press',
        sets: 3,
        reps: [10, 8, 6],
        weights: ['135', '155', '175'],
        primaryMuscleGroup: 'Chest',
      },
      {
        id: 'ex-2',
        exercise: 'Incline Dumbbell Press',
        sets: 3,
        reps: [12, 10, 8],
        weights: ['50', '55', '60'],
        primaryMuscleGroup: 'Chest',
      },
    ],
  },
];

/**
 * Multiple sessions across different days and weeks
 */
export const multipleSessions: WorkoutSession[] = [
  {
    id: 'session-1',
    date: '2024-12-18', // Week 51
    exercises: [
      {
        id: 'ex-1',
        exercise: 'Bench Press',
        sets: 3,
        reps: [10, 8, 6],
        weights: ['135', '155', '175'],
        primaryMuscleGroup: 'Chest',
      },
      {
        id: 'ex-2',
        exercise: 'Squats',
        sets: 4,
        reps: [12, 10, 8, 6],
        weights: ['185', '205', '225', '245'],
        primaryMuscleGroup: 'Quads',
      },
    ],
  },
  {
    id: 'session-2',
    date: '2024-12-17', // Week 51
    exercises: [
      {
        id: 'ex-3',
        exercise: 'Deadlift',
        sets: 5,
        reps: [5, 5, 5, 5, 5],
        weights: ['315', '315', '315', '315', '315'],
        primaryMuscleGroup: 'Back',
      },
      {
        id: 'ex-4',
        exercise: 'Bench Press',
        sets: 3,
        reps: [8, 8, 8],
        weights: ['155', '155', '155'],
        primaryMuscleGroup: 'Chest',
      },
    ],
  },
  {
    id: 'session-3',
    date: '2024-12-10', // Week 50
    exercises: [
      {
        id: 'ex-5',
        exercise: 'Overhead Press',
        sets: 4,
        reps: [8, 8, 6, 6],
        weights: ['95', '95', '105', '105'],
        primaryMuscleGroup: 'Shoulders',
      },
    ],
  },
];

/**
 * Sessions for PR testing with varying weights and reps
 */
export const prTestSessions: WorkoutSession[] = [
  {
    id: 'session-1',
    date: '2024-12-18',
    exercises: [
      {
        id: 'ex-1',
        exercise: 'Bench Press',
        sets: 3,
        reps: [10, 8, 6],
        weights: ['135', '155', '175'], // PR: 175 @ 6 reps
        primaryMuscleGroup: 'Chest',
      },
    ],
  },
  {
    id: 'session-2',
    date: '2024-12-15',
    exercises: [
      {
        id: 'ex-2',
        exercise: 'Bench Press',
        sets: 3,
        reps: [5, 5, 3],
        weights: ['185', '195', '205'], // PR candidate: 205 @ 3 reps (higher weight wins)
        primaryMuscleGroup: 'Chest',
      },
    ],
  },
  {
    id: 'session-3',
    date: '2024-12-12',
    exercises: [
      {
        id: 'ex-3',
        exercise: 'Bench Press',
        sets: 2,
        reps: [4, 5],
        weights: ['205', '205'], // PR: 205 @ 5 reps (same weight, more reps wins)
        primaryMuscleGroup: 'Chest',
      },
    ],
  },
  {
    id: 'session-4',
    date: '2024-12-10',
    exercises: [
      {
        id: 'ex-4',
        exercise: 'Squats',
        sets: 1,
        reps: [3],
        weights: ['315'], // Only squat PR: 315 @ 3 reps
        primaryMuscleGroup: 'Quads',
      },
    ],
  },
];

/**
 * Sessions with bodyweight exercises
 */
export const bodyweightSessions: WorkoutSession[] = [
  {
    id: 'session-1',
    date: '2024-12-18',
    exercises: [
      {
        id: 'ex-1',
        exercise: 'Pull-ups',
        sets: 3,
        reps: [10, 8, 6],
        weights: ['bodyweight', 'bodyweight', 'bodyweight'],
        primaryMuscleGroup: 'Back',
      },
      {
        id: 'ex-2',
        exercise: 'Weighted Pull-ups',
        sets: 3,
        reps: [8, 6, 5],
        weights: ['25', '35', '45'], // Added weight on top of bodyweight
        primaryMuscleGroup: 'Back',
      },
    ],
  },
];

/**
 * Sessions with missing muscle groups (edge case)
 */
export const sessionsWithMissingMuscleGroup: WorkoutSession[] = [
  {
    id: 'session-1',
    date: '2024-12-18',
    exercises: [
      {
        id: 'ex-1',
        exercise: 'Mystery Exercise',
        sets: 3,
        reps: [10, 10, 10],
        weights: ['100', '100', '100'],
        // primaryMuscleGroup is missing/undefined
      },
      {
        id: 'ex-2',
        exercise: 'Bench Press',
        sets: 3,
        reps: [8, 8, 8],
        weights: ['155', '155', '155'],
        primaryMuscleGroup: 'Chest',
      },
    ],
  },
];

/**
 * Sessions spanning multiple weeks for weekly stats testing
 */
export const multiWeekSessions: WorkoutSession[] = [
  // Week 51 (Dec 16-22, 2024)
  {
    id: 'session-w51-1',
    date: '2024-12-18',
    exercises: [
      {
        id: 'ex-1',
        exercise: 'Bench Press',
        sets: 4,
        reps: [10, 10, 8, 8],
        weights: ['135', '145', '155', '155'],
        primaryMuscleGroup: 'Chest',
      },
    ],
  },
  {
    id: 'session-w51-2',
    date: '2024-12-20',
    exercises: [
      {
        id: 'ex-2',
        exercise: 'Incline Press',
        sets: 3,
        reps: [10, 10, 8],
        weights: ['115', '125', '135'],
        primaryMuscleGroup: 'Chest',
      },
    ],
  },
  // Week 50 (Dec 9-15, 2024)
  {
    id: 'session-w50-1',
    date: '2024-12-11',
    exercises: [
      {
        id: 'ex-3',
        exercise: 'Bench Press',
        sets: 3,
        reps: [8, 8, 6],
        weights: ['155', '165', '175'],
        primaryMuscleGroup: 'Chest',
      },
    ],
  },
  // Week 49 (Dec 2-8, 2024)
  {
    id: 'session-w49-1',
    date: '2024-12-04',
    exercises: [
      {
        id: 'ex-4',
        exercise: 'Squats',
        sets: 5,
        reps: [5, 5, 5, 5, 5],
        weights: ['225', '225', '225', '225', '225'],
        primaryMuscleGroup: 'Quads',
      },
    ],
  },
];

/**
 * Sessions for testing fractional set counting with template exercises
 */
export const fractionalSetsSessions: WorkoutSession[] = [
  {
    id: 'session-fractional-1',
    date: '2024-12-18', // Week 51
    exercises: [
      {
        id: 'ex-bench-1',
        exercise: 'Bench Press',
        sets: 3,
        reps: [10, 8, 6],
        weights: ['135', '155', '175'],
        primaryMuscleGroup: 'Chest',
        // Template: Chest 1.0 direct, Arms 0.5, Shoulders 0.5
      },
      {
        id: 'ex-row-1',
        exercise: 'Barbell Row',
        sets: 4,
        reps: [12, 10, 8, 8],
        weights: ['135', '145', '155', '155'],
        primaryMuscleGroup: 'Back',
        // Template: Back 1.0 direct, Arms 0.5, Shoulders 0.5
      },
      {
        id: 'ex-squat-1',
        exercise: 'Squats',
        sets: 4,
        reps: [10, 8, 6, 6],
        weights: ['185', '205', '225', '245'],
        primaryMuscleGroup: 'Quads',
        // Template: Quads 1.0 direct, Hamstrings 0.25
      },
    ],
  },
];

/**
 * Sessions with exercises that have no muscle group data at all (uncategorized)
 */
export const uncategorizedExercisesSessions: WorkoutSession[] = [
  {
    id: 'session-uncategorized-1',
    date: '2024-12-18', // Week 51
    exercises: [
      {
        id: 'ex-mystery-1',
        exercise: 'Mystery Machine', // No template match
        sets: 3,
        reps: [10, 10, 10],
        weights: ['100', '100', '100'],
        // No primaryMuscleGroup - should be uncategorized
      },
      {
        id: 'ex-bench-2',
        exercise: 'Bench Press',
        sets: 3,
        reps: [10, 8, 6],
        weights: ['135', '155', '175'],
        primaryMuscleGroup: 'Chest',
      },
    ],
  },
];

/**
 * Sessions with explicit muscleContributions (server-provided)
 */
export const sessionsWithMuscleContributions: WorkoutSession[] = [
  {
    id: 'session-contrib-1',
    date: '2024-12-18',
    exercises: [
      {
        id: 'ex-custom-1',
        exercise: 'Custom Exercise',
        sets: 3,
        reps: [10, 10, 10],
        weights: ['100', '100', '100'],
        primaryMuscleGroup: 'Chest',
        muscleContributions: [
          { muscleGroup: 'Chest', fraction: 1, isDirect: true },
          { muscleGroup: 'Arms', fraction: 0.3 },
        ],
      },
    ],
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
