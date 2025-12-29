import { WorkoutSession } from '../utils/workoutSessions';

export interface WorkoutRepository {
  listSessions(): Promise<WorkoutSession[]>;
  getWorkoutSession(id: string): Promise<WorkoutSession | null>;
  upsertSession(session: WorkoutSession): Promise<void>;
  deleteSession(id: string): Promise<void>;
}

