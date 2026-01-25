import { WorkoutExercise, WorkoutSession, WorkoutSet } from '@/utils/workoutSessions';

const now = '2026-01-25T10:00:00.000Z';

export function createMockSession(
  date: string,
  exercises: Array<{ name: string; sets: Array<{ reps: number; weight: string }> }>,
  muscleGroups?: Record<string, string>
): WorkoutSession {
  const workoutExercises: WorkoutExercise[] = exercises.map((exercise, exIdx) => {
    const exerciseId = `ex-${date}-${exIdx}`;
    const sets: WorkoutSet[] = exercise.sets.map((set, setIdx) => ({
      id: `set-${exerciseId}-${setIdx}`,
      exerciseId,
      setIndex: setIdx,
      reps: set.reps,
      weightText: set.weight,
      isBodyweight: set.weight.toLowerCase().includes('bodyweight'),
      updatedAt: now,
      createdAt: now,
    }));

    return {
      id: exerciseId,
      sessionId: `session-${date}`,
      nameRaw: exercise.name,
      primaryMuscleGroup: muscleGroups?.[exercise.name],
      sets,
      updatedAt: now,
      createdAt: now,
    };
  });

  return {
    id: `session-${date}`,
    performedOn: date,
    exercises: workoutExercises,
    updatedAt: now,
    createdAt: now,
  };
}

export const planToolSessions: WorkoutSession[] = [
  createMockSession(
    '2026-01-24',
    [
      { name: 'Bench Press', sets: [{ reps: 8, weight: '185' }, { reps: 8, weight: '185' }] },
      { name: 'Barbell Row', sets: [{ reps: 10, weight: '155' }] },
    ],
    { 'Bench Press': 'Chest', 'Barbell Row': 'Back' }
  ),
  createMockSession(
    '2026-01-20',
    [
      { name: 'Bench Press', sets: [{ reps: 8, weight: '182.5' }, { reps: 9, weight: '180' }] },
      { name: 'Squat', sets: [{ reps: 5, weight: '275' }] },
    ],
    { 'Bench Press': 'Chest', Squat: 'Quads' }
  ),
  createMockSession(
    '2026-01-15',
    [{ name: 'Bench Press', sets: [{ reps: 10, weight: '175' }] }],
    { 'Bench Press': 'Chest' }
  ),
];
