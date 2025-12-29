// utils/data/workoutStorage.ts
// Storage wrapper for workout sessions using AsyncStorage

import AsyncStorage from '@react-native-async-storage/async-storage';
import { WorkoutSession } from '../workoutSessions';

const WORKOUT_SESSIONS_KEY = 'workoutSessions';

/**
 * Loads all workout sessions from AsyncStorage
 * @returns Array of workout sessions, or empty array if none exist
 */
export async function loadWorkoutSessions(): Promise<WorkoutSession[]> {
  try {
    const storedSessions = await AsyncStorage.getItem(WORKOUT_SESSIONS_KEY);
    if (!storedSessions) {
      return [];
    }
    return JSON.parse(storedSessions);
  } catch (error) {
    console.error('Failed to load workout sessions:', error);
    return [];
  }
}

/**
 * Saves workout sessions to AsyncStorage
 * @param sessions - Array of workout sessions to save
 */
export async function saveWorkoutSessions(sessions: WorkoutSession[]): Promise<void> {
  try {
    await AsyncStorage.setItem(WORKOUT_SESSIONS_KEY, JSON.stringify(sessions));
  } catch (error) {
    console.error('Failed to save workout sessions:', error);
    throw error;
  }
}

/**
 * Clears all workout sessions from AsyncStorage
 */
export async function clearWorkoutSessions(): Promise<void> {
  try {
    await AsyncStorage.removeItem(WORKOUT_SESSIONS_KEY);
  } catch (error) {
    console.error('Failed to clear workout sessions:', error);
    throw error;
  }
}





