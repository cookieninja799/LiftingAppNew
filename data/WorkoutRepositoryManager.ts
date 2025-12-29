import { WorkoutRepository } from './WorkoutRepository';
import { LocalWorkoutRepository } from './LocalWorkoutRepository';
import { CloudWorkoutRepository } from './CloudWorkoutRepository';
import { WorkoutSession } from '../utils/workoutSessions';

export class WorkoutRepositoryManager implements WorkoutRepository {
  private local: LocalWorkoutRepository;
  private cloud: CloudWorkoutRepository;

  constructor() {
    this.local = new LocalWorkoutRepository();
    this.cloud = new CloudWorkoutRepository();
  }

  async listSessions(): Promise<WorkoutSession[]> {
    // Phase 0-1: Always return local
    return this.local.listSessions();
  }

  async getWorkoutSession(id: string): Promise<WorkoutSession | null> {
    return this.local.getWorkoutSession(id);
  }

  async upsertSession(session: WorkoutSession): Promise<void> {
    // Phase 0: Save locally, stub cloud
    await this.local.upsertSession(session);
    await this.cloud.upsertSession(session);
  }

  async deleteSession(id: string): Promise<void> {
    await this.local.deleteSession(id);
    await this.cloud.deleteSession(id);
  }
}

// Singleton instance
export const workoutRepository = new WorkoutRepositoryManager();

