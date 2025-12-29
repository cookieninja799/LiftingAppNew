import AsyncStorage from '@react-native-async-storage/async-storage';
import { WorkoutRepository } from './WorkoutRepository';
import { WorkoutSession, WorkoutExercise, WorkoutSet } from '../utils/workoutSessions';
import { defaultIdFactory } from '../utils/assistantParsing';

const WORKOUT_SESSIONS_KEY = 'workoutSessions';
const MIGRATION_VERSION_KEY = 'workout_data_version';
const CURRENT_VERSION = 'v2';
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUUID(id?: string): boolean {
  return typeof id === 'string' && UUID_REGEX.test(id);
}

export class LocalWorkoutRepository implements WorkoutRepository {
  async listSessions(): Promise<WorkoutSession[]> {
    await this.ensureMigration();
    return this.readSessions();
  }

  async getWorkoutSession(id: string): Promise<WorkoutSession | null> {
    const sessions = await this.listSessions();
    return sessions.find(s => s.id === id) || null;
  }

  async upsertSession(session: WorkoutSession): Promise<void> {
    const sessions = await this.listSessions();
    const now = new Date().toISOString();

    const nextSessions = [...sessions];
    const existingIndex = nextSessions.findIndex(s => s.id === session.id);
    const mergedSession: WorkoutSession = {
      ...session,
      updatedAt: now,
      createdAt: session.createdAt || now,
    };

    if (existingIndex >= 0) {
      nextSessions[existingIndex] = {
        ...nextSessions[existingIndex],
        ...mergedSession,
      };
    } else {
      nextSessions.push(mergedSession);
    }

    const canonicalized = this.canonicalizeSessions(nextSessions);
    await AsyncStorage.setItem(WORKOUT_SESSIONS_KEY, JSON.stringify(canonicalized));
  }

  async deleteSession(id: string): Promise<void> {
    const sessions = await this.listSessions();
    const remaining = sessions.filter(s => s.id !== id);
    if (remaining.length === sessions.length) return;

    await AsyncStorage.setItem(WORKOUT_SESSIONS_KEY, JSON.stringify(remaining));
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
      let sessions: WorkoutSession[] = [];

      if (Array.isArray(rawData) && rawData.length > 0) {
        const first = rawData[0];
        if (first.date && !first.performedOn) {
          console.log('Migrating workout data from v0 to v1...');
          sessions = this.migrateV0ToV1(rawData);
        } else {
          sessions = rawData;
        }
      }

      const canonicalized = this.canonicalizeSessions(sessions);
      await AsyncStorage.setItem(WORKOUT_SESSIONS_KEY, JSON.stringify(canonicalized));
      await AsyncStorage.setItem(MIGRATION_VERSION_KEY, CURRENT_VERSION);
    } catch (e) {
      console.error('Migration failed:', e);
      await AsyncStorage.setItem(MIGRATION_VERSION_KEY, CURRENT_VERSION);
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
      };
    });
  }

  private canonicalizeSessions(sessions: WorkoutSession[]): WorkoutSession[] {
    const sessionIdMap = new Map<string, string>();
    const exerciseIdMap = new Map<string, string>();
    const setIdMap = new Map<string, string>();
    const now = new Date().toISOString();

    const normalizeId = (rawId: string | undefined, map: Map<string, string>) => {
      if (rawId && isValidUUID(rawId)) return rawId;
      const key = rawId || defaultIdFactory();
      if (!map.has(key)) {
        map.set(key, defaultIdFactory());
      }
      return map.get(key)!;
    };

    return sessions
      // Remove any previously soft-deleted sessions
      .filter(s => !(s as any).deletedAt)
      .map(session => {
        const sessionId = normalizeId(session.id, sessionIdMap);
        const sessionCreatedAt = session.createdAt || now;
        const sessionUpdatedAt = session.updatedAt || now;

        const exercises = (session.exercises || []).map(ex => {
          const exerciseId = normalizeId(ex.id, exerciseIdMap);

          const sets = (ex.sets || []).map(set => {
            const setId = normalizeId(set.id, setIdMap);
            return {
              ...set,
              id: setId,
              exerciseId,
              updatedAt: set.updatedAt || now,
              createdAt: set.createdAt || now,
            };
          });

          return {
            ...ex,
            id: exerciseId,
            sessionId,
            sets,
            updatedAt: ex.updatedAt || now,
            createdAt: ex.createdAt || now,
          };
        });

        return {
          id: sessionId,
          performedOn: session.performedOn,
          title: session.title,
          notes: session.notes,
          source: session.source,
          exercises,
          updatedAt: sessionUpdatedAt,
          createdAt: sessionCreatedAt,
        };
      });
  }

  private async readSessions(): Promise<WorkoutSession[]> {
    const data = await AsyncStorage.getItem(WORKOUT_SESSIONS_KEY);
    if (!data) return [];
    try {
      return JSON.parse(data) as WorkoutSession[];
    } catch {
      return [];
    }
  }
}

