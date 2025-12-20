// __tests__/unit/workoutSessionsMerge.test.ts
import { ParsedExercise } from '../../utils/assistantParsing';
import {
    mergeExercisesIntoSessions,
    sortSessionsByDateDesc,
    WorkoutSession,
} from '../../utils/workoutSessions';

// Deterministic ID factory for testing
let sessionIdCounter = 0;
const testSessionIdFactory = () => `session-${++sessionIdCounter}`;

beforeEach(() => {
  sessionIdCounter = 0;
});

describe('mergeExercisesIntoSessions', () => {
  it('should create a new session when merging into empty sessions', () => {
    const parsedExercises: ParsedExercise[] = [
      {
        id: 'ex-1',
        date: '2024-12-19',
        exercise: 'Bench Press',
        sets: 3,
        reps: [10, 10, 10],
        weights: ['135', '135', '135'],
        primaryMuscleGroup: 'Chest',
      },
    ];

    const result = mergeExercisesIntoSessions([], parsedExercises, {
      sessionIdFactory: testSessionIdFactory,
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'session-1',
      date: '2024-12-19',
      exercises: [
        {
          id: 'ex-1',
          exercise: 'Bench Press',
          sets: 3,
          reps: [10, 10, 10],
          weights: ['135', '135', '135'],
          primaryMuscleGroup: 'Chest',
        },
      ],
    });
  });

  it('should append exercises to existing session with same date', () => {
    const existingSessions: WorkoutSession[] = [
      {
        id: 'existing-session',
        date: '2024-12-18',
        exercises: [
          {
            id: 'existing-ex',
            exercise: 'Squats',
            sets: 4,
            reps: [10, 10, 8, 8],
            weights: ['185', '205', '225', '225'],
            primaryMuscleGroup: 'Quads',
          },
        ],
      },
    ];

    const parsedExercises: ParsedExercise[] = [
      {
        id: 'new-ex',
        date: '2024-12-18', // Same date as existing session
        exercise: 'Leg Press',
        sets: 3,
        reps: [15, 12, 10],
        weights: ['270', '360', '450'],
        primaryMuscleGroup: 'Quads',
      },
    ];

    const result = mergeExercisesIntoSessions(existingSessions, parsedExercises, {
      sessionIdFactory: testSessionIdFactory,
    });

    expect(result).toHaveLength(1);
    expect(result[0].exercises).toHaveLength(2);
    expect(result[0].exercises[0].exercise).toBe('Squats');
    expect(result[0].exercises[1].exercise).toBe('Leg Press');
  });

  it('should create new session for different date', () => {
    const existingSessions: WorkoutSession[] = [
      {
        id: 'existing-session',
        date: '2024-12-17',
        exercises: [
          {
            id: 'existing-ex',
            exercise: 'Deadlift',
            sets: 5,
            reps: [5, 5, 5, 5, 5],
            weights: ['315', '315', '315', '315', '315'],
            primaryMuscleGroup: 'Back',
          },
        ],
      },
    ];

    const parsedExercises: ParsedExercise[] = [
      {
        id: 'new-ex',
        date: '2024-12-18', // Different date
        exercise: 'Bench Press',
        sets: 3,
        reps: [10, 8, 6],
        weights: ['135', '155', '175'],
        primaryMuscleGroup: 'Chest',
      },
    ];

    const result = mergeExercisesIntoSessions(existingSessions, parsedExercises, {
      sessionIdFactory: testSessionIdFactory,
    });

    expect(result).toHaveLength(2);
    expect(result[0].date).toBe('2024-12-17');
    expect(result[1].date).toBe('2024-12-18');
  });

  it('should not mutate original sessions array', () => {
    const originalSessions: WorkoutSession[] = [
      {
        id: 'session-1',
        date: '2024-12-18',
        exercises: [
          {
            id: 'ex-1',
            exercise: 'Bench Press',
            sets: 3,
            reps: [10, 10, 10],
            weights: ['135', '135', '135'],
            primaryMuscleGroup: 'Chest',
          },
        ],
      },
    ];

    const originalExercisesCount = originalSessions[0].exercises.length;

    const parsedExercises: ParsedExercise[] = [
      {
        id: 'new-ex',
        date: '2024-12-18',
        exercise: 'Incline Press',
        sets: 3,
        reps: [10, 10, 10],
        weights: ['95', '95', '95'],
        primaryMuscleGroup: 'Chest',
      },
    ];

    mergeExercisesIntoSessions(originalSessions, parsedExercises, {
      sessionIdFactory: testSessionIdFactory,
    });

    // Original should not be modified
    expect(originalSessions[0].exercises.length).toBe(originalExercisesCount);
  });

  it('should handle multiple exercises for multiple dates', () => {
    const parsedExercises: ParsedExercise[] = [
      {
        id: 'ex-1',
        date: '2024-12-18',
        exercise: 'Bench Press',
        sets: 3,
        reps: [10, 8, 6],
        weights: ['135', '155', '175'],
        primaryMuscleGroup: 'Chest',
      },
      {
        id: 'ex-2',
        date: '2024-12-17',
        exercise: 'Squats',
        sets: 4,
        reps: [12, 10, 8, 6],
        weights: ['185', '205', '225', '245'],
        primaryMuscleGroup: 'Quads',
      },
      {
        id: 'ex-3',
        date: '2024-12-18', // Same date as first exercise
        exercise: 'Incline Press',
        sets: 3,
        reps: [10, 10, 10],
        weights: ['95', '105', '115'],
        primaryMuscleGroup: 'Chest',
      },
    ];

    const result = mergeExercisesIntoSessions([], parsedExercises, {
      sessionIdFactory: testSessionIdFactory,
    });

    expect(result).toHaveLength(2);
    
    // Find sessions by date
    const dec18Session = result.find(s => s.date === '2024-12-18');
    const dec17Session = result.find(s => s.date === '2024-12-17');

    expect(dec18Session?.exercises).toHaveLength(2);
    expect(dec18Session?.exercises[0].exercise).toBe('Bench Press');
    expect(dec18Session?.exercises[1].exercise).toBe('Incline Press');
    expect(dec17Session?.exercises).toHaveLength(1);
    expect(dec17Session?.exercises[0].exercise).toBe('Squats');
  });

  it('should preserve session structure expected by Logs/Analytics/PRTab', () => {
    const parsedExercises: ParsedExercise[] = [
      {
        id: 'ex-1',
        date: '2024-12-18',
        exercise: 'Bench Press',
        sets: 3,
        reps: [10, 8, 6],
        weights: ['135', '155', '175'],
        primaryMuscleGroup: 'Chest',
      },
    ];

    const result = mergeExercisesIntoSessions([], parsedExercises, {
      sessionIdFactory: testSessionIdFactory,
    });

    // Verify structure matches what other components expect
    const session = result[0];
    expect(session).toHaveProperty('id');
    expect(session).toHaveProperty('date');
    expect(session).toHaveProperty('exercises');
    expect(Array.isArray(session.exercises)).toBe(true);
    
    const exercise = session.exercises[0];
    expect(exercise).toHaveProperty('id');
    expect(exercise).toHaveProperty('exercise');
    expect(exercise).toHaveProperty('sets');
    expect(exercise).toHaveProperty('reps');
    expect(exercise).toHaveProperty('weights');
    expect(exercise).toHaveProperty('primaryMuscleGroup');
    expect(Array.isArray(exercise.reps)).toBe(true);
    expect(Array.isArray(exercise.weights)).toBe(true);
  });
});

describe('sortSessionsByDateDesc', () => {
  it('should sort sessions by date in descending order', () => {
    const sessions: WorkoutSession[] = [
      { id: '1', date: '2024-12-15', exercises: [] },
      { id: '2', date: '2024-12-18', exercises: [] },
      { id: '3', date: '2024-12-10', exercises: [] },
      { id: '4', date: '2024-12-17', exercises: [] },
    ];

    const sorted = sortSessionsByDateDesc(sessions);

    expect(sorted[0].date).toBe('2024-12-18');
    expect(sorted[1].date).toBe('2024-12-17');
    expect(sorted[2].date).toBe('2024-12-15');
    expect(sorted[3].date).toBe('2024-12-10');
  });

  it('should not mutate original array', () => {
    const sessions: WorkoutSession[] = [
      { id: '1', date: '2024-12-15', exercises: [] },
      { id: '2', date: '2024-12-18', exercises: [] },
    ];

    const sorted = sortSessionsByDateDesc(sessions);

    expect(sessions[0].date).toBe('2024-12-15'); // Original unchanged
    expect(sorted[0].date).toBe('2024-12-18'); // Sorted result
  });

  it('should handle empty array', () => {
    const sorted = sortSessionsByDateDesc([]);
    expect(sorted).toHaveLength(0);
  });
});
