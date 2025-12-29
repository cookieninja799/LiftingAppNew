import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemePreference } from './types';

const THEME_PREFERENCE_KEY = 'theme-preference';

// Memory storage for Node environment to prevent AsyncStorage from crashing
const memoryStorage: Record<string, string> = {};

export async function getThemePreference(): Promise<ThemePreference> {
  if (typeof window === 'undefined') {
    const val = memoryStorage[THEME_PREFERENCE_KEY];
    return (val === 'light' || val === 'dark' || val === 'system') ? val as ThemePreference : 'system';
  }

  try {
    const value = await AsyncStorage.getItem(THEME_PREFERENCE_KEY);
    if (value === 'light' || value === 'dark' || value === 'system') {
      return value;
    }
    return 'system';
  } catch {
    return 'system';
  }
}

export async function setThemePreference(preference: ThemePreference): Promise<void> {
  if (typeof window === 'undefined') {
    memoryStorage[THEME_PREFERENCE_KEY] = preference;
    return;
  }

  try {
    await AsyncStorage.setItem(THEME_PREFERENCE_KEY, preference);
  } catch (error) {
    console.error('Failed to save theme preference:', error);
  }
}






