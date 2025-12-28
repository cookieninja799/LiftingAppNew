import AsyncStorage from '@react-native-async-storage/async-storage';
import { WorkoutRepository } from './WorkoutRepository';
import { WorkoutSession, WorkoutExercise, WorkoutSet } from '../utils/workoutSessions';
import { defaultIdFactory } from '../utils/assistantParsing';

const WORKOUT_SESSIONS_KEY = 'workoutSessions';
const MIGRATION_VERSION_KEY = 'workout_data_version';
const CURRENT_VERSION = 'v1';

export class LocalWorkoutRepository implements WorkoutRepository {
  async listSessions(includeDeleted = false): Promise<WorkoutSession[]> {
    await this.ensureMigration();
    const data = await AsyncStorage.getItem(WORKOUT_SESSIONS_KEY);
    if (!data) return [];
    const sessions: WorkoutSession[] = JSON.parse(data);
    if (includeDeleted) return sessions;
    return sessions.filter(s => !s.deletedAt);
  }

  async getWorkoutSession(id: string): Promise<WorkoutSession | null> {
    const sessions = await this.listSessions(true); // Check all
    return sessions.find(s => s.id === id) || null;
  }

  async upsertSession(session: WorkoutSession): Promise<void> {
    const sessions = await this.listSessions(true); // Get all including deleted
    const index = sessions.findIndex(s => s.id === session.id);
    
    const updatedSession = {
      ...session,
      updatedAt: new Date().toISOString(),
    };

    if (index !== -1) {
      sessions[index] = updatedSession;
    } else {
      sessions.push(updatedSession);
    }

    await AsyncStorage.setItem(WORKOUT_SESSIONS_KEY, JSON.stringify(sessions));
  }

  async softDeleteSession(id: string): Promise<void> {
    const sessions = await this.listSessions(true); // Get all
    const index = sessions.findIndex(s => s.id === id);
    if (index !== -1) {
      sessions[index].deletedAt = new Date().toISOString();
      sessions[index].updatedAt = new Date().toISOString();
      await AsyncStorage.setItem(WORKOUT_SESSIONS_KEY, JSON.stringify(sessions));
    }
  }

  private async ensureMigration() {
    const version = await AsyncStorage.getItem(MIGRATION_VERSION_KEY);
    if (version === CURRENT_VERSION) return;

    const data = await AsyncStorage.getItem(WORKOUT_SESSIONS_KEY);
    if (!data) {
      await AsyncStorage.setItem(MIGRATION_VERSION_KEY, CURRENT_VERSION);
      return;
    }

    try {
      const rawData = JSON.parse(data);
      if (Array.isArray(rawData) && rawData.length > 0) {
        // Check if first element is v0
        const first = rawData[0];
        if (first.date && !first.performedOn) {
          console.log('Migrating workout data from v0 to v1...');
          const migrated = this.migrateV0ToV1(rawData);
          await AsyncStorage.setItem(WORKOUT_SESSIONS_KEY, JSON.stringify(migrated));
        }
      }
      await AsyncStorage.setItem(MIGRATION_VERSION_KEY, CURRENT_VERSION);
    } catch (e) {
      console.error('Migration failed:', e);
    }
  }

  private migrateV0ToV1(v0Sessions: any[]): WorkoutSession[] {
    const now = new Date().toISOString();
    return v0Sessions.map(v0 => {
      const sessionId = v0.id || defaultIdFactory();
      const exercises: WorkoutExercise[] = (v0.exercises || []).map((v0Ex: any) => {
        const exerciseId = v0Ex.id || defaultIdFactory();
        
        // Normalize sets
        const reps = v0Ex.reps || [];
        const weights = v0Ex.weights || [];
        const setCount = Math.max(reps.length, weights.length, v0Ex.sets || 0);
        
        const sets: WorkoutSet[] = [];
        for (let i = 0; i < setCount; i++) {
          sets.push({
            id: defaultIdFactory(),
            exerciseId,
            setIndex: i,
            reps: reps[i] || 0,
            weightText: weights[i] || '0',
            isBodyweight: false,
            updatedAt: now,
            createdAt: now,
          });
        }

        return {
          id: exerciseId,
          sessionId,
          nameRaw: v0Ex.exercise || 'Unknown Exercise',
          primaryMuscleGroup: v0Ex.primaryMuscleGroup,
          muscleContributions: v0Ex.muscleContributions,
          sets,
          updatedAt: now,
          createdAt: now,
        };
      });

      return {
        id: sessionId,
        performedOn: v0.date,
        exercises,
        updatedAt: now,
        createdAt: now,
        deletedAt: null,
      };
    });
  }
}

