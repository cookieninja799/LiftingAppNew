import AsyncStorage from '@react-native-async-storage/async-storage';

export interface NormalizationSettings {
  enableNormalization: boolean;
}

const SETTINGS_KEY = 'exercise_normalization_settings';

const DEFAULT_SETTINGS: NormalizationSettings = {
  enableNormalization: true,
};

export async function loadNormalizationSettings(): Promise<NormalizationSettings> {
  try {
    const stored = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!stored) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
  } catch (error) {
    console.error('Failed to load normalization settings:', error);
    return DEFAULT_SETTINGS;
  }
}

export async function saveNormalizationSettings(settings: NormalizationSettings): Promise<void> {
  try {
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('Failed to save normalization settings:', error);
    throw error;
  }
}
