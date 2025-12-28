import AsyncStorage from '@react-native-async-storage/async-storage';
import { workoutRepository } from './WorkoutRepositoryManager';
import { CloudWorkoutRepository } from './CloudWorkoutRepository';
import { LocalWorkoutRepository } from './LocalWorkoutRepository';
import { WorkoutSession } from '../utils/workoutSessions';

const LAST_SYNC_KEY = 'last_sync_at';
const HAS_MIGRATED_KEY = 'has_migrated_to_cloud';

export class SyncEngine {
  private local = new LocalWorkoutRepository();
  private cloud = new CloudWorkoutRepository();

  /**
   * Performs a one-time migration of local data to the cloud for a new user.
   */
  async migrateLocalToCloud(): Promise<void> {
    const hasMigrated = await AsyncStorage.getItem(HAS_MIGRATED_KEY);
    if (hasMigrated === 'true') return;

    console.log('Starting initial migration to cloud...');
    const localSessions = await this.local.listSessions();
    
    for (const session of localSessions) {
      try {
        await this.cloud.upsertSession(session);
      } catch (e) {
        console.error(`Failed to migrate session ${session.id}:`, e);
      }
    }

    await AsyncStorage.setItem(HAS_MIGRATED_KEY, 'true');
    await AsyncStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
    console.log('Initial migration completed.');
  }

  /**
   * Main sync logic: "Latest updatedAt wins"
   */
  async syncNow(): Promise<{ pulled: number; pushed: number }> {
    const lastSyncStr = await AsyncStorage.getItem(LAST_SYNC_KEY);
    const lastSyncAt = lastSyncStr ? new Date(lastSyncStr) : new Date(0);
    const now = new Date().toISOString();

    let pulledCount = 0;
    let pushedCount = 0;

    // 1. Pull changes from cloud
    const cloudSessions = await this.cloud.listSessions();
    const localSessions = await this.local.listSessions();

    for (const remote of cloudSessions) {
      const local = localSessions.find(s => s.id === remote.id);
      if (!local || new Date(remote.updatedAt) > new Date(local.updatedAt)) {
        await this.local.upsertSession(remote);
        pulledCount++;
      }
    }

    // 2. Push changes to cloud
    // Re-list local to get updated state
    const currentLocalSessions = await this.local.listSessions();
    for (const local of currentLocalSessions) {
      if (new Date(local.updatedAt) > lastSyncAt) {
        await this.cloud.upsertSession(local);
        pushedCount++;
      }
    }

    await AsyncStorage.setItem(LAST_SYNC_KEY, now);
    return { pulled: pulledCount, pushed: pushedCount };
  }

  async getLastSyncTime(): Promise<string | null> {
    return AsyncStorage.getItem(LAST_SYNC_KEY);
  }
}

export const syncEngine = new SyncEngine();

