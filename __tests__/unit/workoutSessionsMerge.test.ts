// __tests__/unit/workoutSessionsMerge.test.ts
import { ParsedExercise } from '../../utils/assistantParsing';
import {
    mergeExercisesIntoSessions,
    sortSessionsByDateDesc,
    WorkoutSession,
} from '../../utils/workoutSessions';

// Deterministic ID factory for testing
let sessionIdCounter = 0;
let exerciseIdCounter = 0;
let setIdCounter = 0;
const testSessionIdFactory = () => `session-${++sessionIdCounter}`;
const testExerciseIdFactory = () => `ex-${++exerciseIdCounter}`;
const testSetIdFactory = () => `set-${++setIdCounter}`;

beforeEach(() => {
  sessionIdCounter = 0;
  exerciseIdCounter = 0;
  setIdCounter = 0;
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
      exerciseIdFactory: testExerciseIdFactory,
      setIdFactory: testSetIdFactory,
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'session-1',
      performedOn: '2024-12-19',
      exercises: expect.arrayContaining([
        expect.objectContaining({
          id: 'ex-1',
          nameRaw: 'Bench Press',
          primaryMuscleGroup: 'Chest',
        }),
      ]),
    });
    expect(result[0].exercises[0].sets).toHaveLength(3);
    expect(result[0].exercises[0].sets[0]).toMatchObject({
      reps: 10,
      weightText: '135',
    });
  });

  it('should append exercises to existing session with same date', () => {
    const now = new Date().toISOString();
    const existingSessions: WorkoutSession[] = [
      {
        id: 'existing-session',
        performedOn: '2024-12-18',
        exercises: [
          {
            id: 'existing-ex',
            sessionId: 'existing-session',
            nameRaw: 'Squats',
            sets: [
              {
                id: 'set-1',
                exerciseId: 'existing-ex',
                setIndex: 0,
                reps: 10,
                weightText: '185',
                isBodyweight: false,
                updatedAt: now,
                createdAt: now,
              },
            ],
            updatedAt: now,
            createdAt: now,
          },
        ],
        updatedAt: now,
        createdAt: now,
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
      exerciseIdFactory: testExerciseIdFactory,
      setIdFactory: testSetIdFactory,
    });

    expect(result).toHaveLength(1);
    expect(result[0].exercises).toHaveLength(2);
    expect(result[0].exercises[0].nameRaw).toBe('Squats');
    expect(result[0].exercises[1].nameRaw).toBe('Leg Press');
    expect(result[0].exercises[1].sets).toHaveLength(3);
  });

  it('should create new session for different date', () => {
    const now = new Date().toISOString();
    const existingSessions: WorkoutSession[] = [
      {
        id: 'existing-session',
        performedOn: '2024-12-17',
        exercises: [
          {
            id: 'existing-ex',
            sessionId: 'existing-session',
            nameRaw: 'Deadlift',
            sets: [
              {
                id: 'set-1',
                exerciseId: 'existing-ex',
                setIndex: 0,
                reps: 5,
                weightText: '315',
                isBodyweight: false,
                updatedAt: now,
                createdAt: now,
              },
            ],
            updatedAt: now,
            createdAt: now,
          },
        ],
        updatedAt: now,
        createdAt: now,
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
      exerciseIdFactory: testExerciseIdFactory,
      setIdFactory: testSetIdFactory,
    });

    expect(result).toHaveLength(2);
    expect(result[0].performedOn).toBe('2024-12-17');
    expect(result[1].performedOn).toBe('2024-12-18');
  });

  it('should not mutate original sessions array', () => {
    const now = new Date().toISOString();
    const originalSessions: WorkoutSession[] = [
      {
        id: 'session-1',
        performedOn: '2024-12-18',
        exercises: [
          {
            id: 'ex-1',
            sessionId: 'session-1',
            nameRaw: 'Bench Press',
            sets: [
              {
                id: 'set-1',
                exerciseId: 'ex-1',
                setIndex: 0,
                reps: 10,
                weightText: '135',
                isBodyweight: false,
                updatedAt: now,
                createdAt: now,
              },
            ],
            updatedAt: now,
            createdAt: now,
          },
        ],
        updatedAt: now,
        createdAt: now,
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
      exerciseIdFactory: testExerciseIdFactory,
      setIdFactory: testSetIdFactory,
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
      exerciseIdFactory: testExerciseIdFactory,
      setIdFactory: testSetIdFactory,
    });

    expect(result).toHaveLength(2);
    
    // Find sessions by date
    const dec18Session = result.find(s => s.performedOn === '2024-12-18');
    const dec17Session = result.find(s => s.performedOn === '2024-12-17');

    expect(dec18Session?.exercises).toHaveLength(2);
    expect(dec18Session?.exercises[0].nameRaw).toBe('Bench Press');
    expect(dec18Session?.exercises[1].nameRaw).toBe('Incline Press');
    expect(dec17Session?.exercises).toHaveLength(1);
    expect(dec17Session?.exercises[0].nameRaw).toBe('Squats');
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
      exerciseIdFactory: testExerciseIdFactory,
      setIdFactory: testSetIdFactory,
    });

    // Verify structure matches what other components expect
    const session = result[0];
    expect(session).toHaveProperty('id');
    expect(session).toHaveProperty('performedOn');
    expect(session).toHaveProperty('exercises');
    expect(Array.isArray(session.exercises)).toBe(true);
    
    const exercise = session.exercises[0];
    expect(exercise).toHaveProperty('id');
    expect(exercise).toHaveProperty('nameRaw');
    expect(exercise).toHaveProperty('sets');
    expect(exercise).toHaveProperty('primaryMuscleGroup');
    expect(Array.isArray(exercise.sets)).toBe(true);
    
    const set = exercise.sets[0];
    expect(set).toHaveProperty('reps');
    expect(set).toHaveProperty('weightText');
  });

  it('should preserve muscleContributions when present', () => {
    const parsedExercises: ParsedExercise[] = [
      {
        id: 'ex-1',
        date: '2024-12-18',
        exercise: 'Custom Press',
        sets: 3,
        reps: [10, 8, 6],
        weights: ['135', '155', '175'],
        primaryMuscleGroup: 'Chest',
        muscleContributions: [
          { muscleGroup: 'Chest', fraction: 1, isDirect: true },
          { muscleGroup: 'Arms', fraction: 0.5 },
          { muscleGroup: 'Shoulders', fraction: 0.5 },
        ],
      },
    ];

    const result = mergeExercisesIntoSessions([], parsedExercises, {
      sessionIdFactory: testSessionIdFactory,
      exerciseIdFactory: testExerciseIdFactory,
      setIdFactory: testSetIdFactory,
    });

    const exercise = result[0].exercises[0];
    expect(exercise.muscleContributions).toBeDefined();
    expect(exercise.muscleContributions).toHaveLength(3);
    expect(exercise.muscleContributions![0]).toMatchObject({
      muscleGroup: 'Chest',
      fraction: 1,
      isDirect: true,
    });
    expect(exercise.muscleContributions![1]).toMatchObject({
      muscleGroup: 'Arms',
      fraction: 0.5,
    });
    expect(exercise.muscleContributions![2]).toMatchObject({
      muscleGroup: 'Shoulders',
      fraction: 0.5,
    });
  });

  it('should handle undefined muscleContributions', () => {
    const parsedExercises: ParsedExercise[] = [
      {
        id: 'ex-1',
        date: '2024-12-18',
        exercise: 'Bench Press',
        sets: 3,
        reps: [10, 8, 6],
        weights: ['135', '155', '175'],
        primaryMuscleGroup: 'Chest',
        // muscleContributions is undefined
      },
    ];

    const result = mergeExercisesIntoSessions([], parsedExercises, {
      sessionIdFactory: testSessionIdFactory,
      exerciseIdFactory: testExerciseIdFactory,
      setIdFactory: testSetIdFactory,
    });

    const exercise = result[0].exercises[0];
    expect(exercise.muscleContributions).toBeUndefined();
  });
});

describe('sortSessionsByDateDesc', () => {
  it('should sort sessions by date in descending order', () => {
    const now = new Date().toISOString();
    const sessions: WorkoutSession[] = [
      { id: '1', performedOn: '2024-12-15', exercises: [], updatedAt: now, createdAt: now },
      { id: '2', performedOn: '2024-12-18', exercises: [], updatedAt: now, createdAt: now },
      { id: '3', performedOn: '2024-12-10', exercises: [], updatedAt: now, createdAt: now },
      { id: '4', performedOn: '2024-12-17', exercises: [], updatedAt: now, createdAt: now },
    ];

    const sorted = sortSessionsByDateDesc(sessions);

    expect(sorted[0].performedOn).toBe('2024-12-18');
    expect(sorted[1].performedOn).toBe('2024-12-17');
    expect(sorted[2].performedOn).toBe('2024-12-15');
    expect(sorted[3].performedOn).toBe('2024-12-10');
  });

  it('should not mutate original array', () => {
    const now = new Date().toISOString();
    const sessions: WorkoutSession[] = [
      { id: '1', performedOn: '2024-12-15', exercises: [], updatedAt: now, createdAt: now },
      { id: '2', performedOn: '2024-12-18', exercises: [], updatedAt: now, createdAt: now },
    ];

    const sorted = sortSessionsByDateDesc(sessions);

    expect(sessions[0].performedOn).toBe('2024-12-15'); // Original unchanged
    expect(sorted[0].performedOn).toBe('2024-12-18'); // Sorted result
  });

  it('should handle empty array', () => {
    const sorted = sortSessionsByDateDesc([]);
    expect(sorted).toHaveLength(0);
  });
});
