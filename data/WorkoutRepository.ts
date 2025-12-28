import { WorkoutSession } from '../utils/workoutSessions';

export interface WorkoutRepository {
  listSessions(includeDeleted?: boolean): Promise<WorkoutSession[]>;
  getWorkoutSession(id: string): Promise<WorkoutSession | null>;
  upsertSession(session: WorkoutSession): Promise<void>;
  softDeleteSession(id: string): Promise<void>;
}

