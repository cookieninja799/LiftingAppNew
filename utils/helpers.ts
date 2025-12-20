import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

let cachedUserProfile: { age: string; gender: string; weight: string; height: string } | null = null;

// Call this function at app startup (or when profile changes) to cache the profile.
export const loadUserProfile = async (): Promise<void> => {
  try {
    const profileString = await AsyncStorage.getItem('userProfile');
    if (profileString) {
      cachedUserProfile = JSON.parse(profileString);
    }
  } catch (error) {
    console.error('Failed to load user profile:', error);
  }
};

export const getUserBodyWeight = (): number => {
  if (cachedUserProfile && cachedUserProfile.weight) {
    const bw = parseInt(cachedUserProfile.weight, 10);
    return isNaN(bw) ? 100 : bw;
  }
  // Default if profile not loaded
  return 100;
};

export const getCurrentWeek = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const week = getWeekNumber(now);
  return `${year}-W${week}`;
};

export const getWeekFromDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const week = getWeekNumber(date);
  return `${year}-W${week}`;
};

export const getMonthFromDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = date.toLocaleString('default', { month: 'long' });
  return `${month} ${year}`;
};

const getWeekNumber = (date: Date): number => {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDays = Math.floor((date.getTime() - firstDayOfYear.getTime()) / (24 * 60 * 60 * 1000));
  return Math.ceil((pastDays + firstDayOfYear.getDay() + 1) / 7);
};

export const optimalSetRecommendations: Record<string, { min: string; optimal: string; upper: string }> = {
  "Chest": { min: "6-8", optimal: "12-18", upper: "20-25" },
  "Back": { min: "8-10", optimal: "14-20", upper: "22-25" },
  "Quads": { min: "6-10", optimal: "12-18", upper: "20-25" },
  "Hamstrings": { min: "5-8", optimal: "10-15", upper: "18-20" },
  "Shoulders": { min: "5-8", optimal: "10-15", upper: "18-20" },
  "Arms": { min: "6-10", optimal: "12-15", upper: "18-20" },
};

export type SetCountMode = 'direct' | 'fractional' | 'touched';

/**
 * Get the set type label for display in status messages
 */
function getSetTypeLabel(mode: SetCountMode): string {
  switch (mode) {
    case 'direct':
      return 'direct sets';
    case 'fractional':
      return 'fractional sets';
    case 'touched':
      return 'touched sets';
  }
}

export const getVolumeStatus = (
  muscleGroup: string, 
  totalWeeklySets: number,
  mode: SetCountMode = 'fractional'
): string => {
  const guideline = optimalSetRecommendations[muscleGroup];
  const setTypeLabel = getSetTypeLabel(mode);
  
  if (totalWeeklySets === 0)
    return `😴 No gains: Time to rise and shine in the gym! Add at least a few ${setTypeLabel}.`;
  if (!guideline) return "No Guideline";

  // Parse the guideline boundaries 
  const minSets = parseInt(guideline.min.split('-')[0]);
  const optimalMin = parseInt(guideline.optimal.split('-')[0]);
  const optimalMax = parseInt(guideline.optimal.split('-')[1]);
  const maxSets = parseInt(guideline.upper.split('-')[0]);

  // For fractional mode, use rounded values for comparison but show decimals in messages
  const roundedSets = Math.round(totalWeeklySets * 10) / 10;

  if (roundedSets < minSets) {
    const diff = Math.round((minSets - roundedSets) * 10) / 10;
    return `😬 Too Low: Your muscles are snoozing—pump up the volume! Add ${diff} ${setTypeLabel} to reach the minimum effective range.`;
  } else if (roundedSets >= minSets && roundedSets < minSets + 0.5) {
    const diff = Math.round((optimalMin - roundedSets) * 10) / 10;
    return `👍 Minimum reached: Welcome to the gains club! Add ${diff} more ${setTypeLabel} to hit the lower optimal threshold.`;
  } else if (roundedSets > minSets && roundedSets < optimalMin) {
    const diff = Math.round((optimalMin - roundedSets) * 10) / 10;
    return `🚀 Almost there: Just ${diff} more ${setTypeLabel} and you'll be flexin' like a pro!`;
  } else if (roundedSets >= optimalMin && roundedSets < optimalMin + 0.5) {
    const diff = Math.round((optimalMax - roundedSets) * 10) / 10;
    return `🎉 Lower optimal reached: Your gains are getting serious! Add ${diff} more ${setTypeLabel} for maximum benefits.`;
  } else if (roundedSets > optimalMin && roundedSets < optimalMax) {
    return `💪 Optimal: Gains on point—keep rocking those ${setTypeLabel}!`;
  } else if (roundedSets >= optimalMax && roundedSets < optimalMax + 0.5) {
    return `🎊 Upper optimal reached: Maximum gains unlocked! You're right on target with your ${setTypeLabel}.`;
  } else if (roundedSets > optimalMax && roundedSets <= maxSets) {
    const diff = Math.round((roundedSets - optimalMax) * 10) / 10;
    return `😎 Overachiever: Crushing it, but maybe ease off by ${diff} ${setTypeLabel} to stay in the optimal zone.`;
  } else {
    const diff = Math.round((roundedSets - maxSets) * 10) / 10;
    return `⚠️ Danger: Overtraining detected! Reduce by ${diff} ${setTypeLabel} to get back to safe territory.`;
  }
};



export const computeVolumeForExercise = (exercise: { exercise: string; sets: number; reps: number[]; weights: string[] }): number => {
  let volume = 0;
  const userBW = getUserBodyWeight();

  for (let i = 0; i < exercise.sets; i++) {
    const reps = exercise.reps[i] || 0;
    const weightStr = exercise.weights[i] || "0";
    let weight = parseInt(weightStr.replace(/\D/g, "")) || 0;

    // Handle pure bodyweight exercises
    if (weightStr.toLowerCase() === "bodyweight") {
      weight = userBW;
    }

    // Handle weighted bodyweight exercises (e.g., "Weighted Pull-ups")
    if (exercise.exercise.toLowerCase().includes("weighted") && weight > 0) {
      weight += userBW;
    }

    volume += reps * weight;
  }

  return volume;
};

export const getColorForTotalSets = (
  totalSets: number,
  maxTotalSets: number,
  scheme: 'light' | 'dark' = 'light'
): string => {
  // Avoid divide-by-zero and show "no activity" color
  if (maxTotalSets <= 0 || totalSets <= 0) {
    return scheme === 'dark' ? '#111827' : '#e2e8f0';
  }

  const ratio = Math.min(totalSets / maxTotalSets, 1);

  // Light palette leans on indigo; dark palette uses deeper shades for contrast
  const palette =
    scheme === 'dark'
      ? ['#1f2937', '#312e81', '#4338ca', '#4f46e5', '#6366f1']
      : ['#e2e8f0', '#c7d2fe', '#a5b4fc', '#818cf8', '#4f46e5'];

  if (ratio >= 0.9) return palette[4];
  if (ratio >= 0.7) return palette[3];
  if (ratio >= 0.5) return palette[2];
  if (ratio >= 0.25) return palette[1];
  return palette[0];
};

/**
 * Get the API base URL based on the platform and environment.
 * For web, uses localhost to avoid mixed content issues.
 * For native, uses the network IP address.
 */
export const getApiBaseUrl = (): string => {
  // Check for environment variable first
  if (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  
  // For web platform, use localhost to avoid mixed content issues
  if (Platform.OS === 'web') {
    // Check if we're in a secure context (HTTPS)
    if (typeof window !== 'undefined' && window.isSecureContext) {
      // Use localhost for same-origin requests (avoids mixed content)
      return 'http://localhost:3000';
    }
    // Fallback to localhost even in non-secure context
    return 'http://localhost:3000';
  }
  
  // For native platforms (iOS/Android), use the network IP
  // Note: Update this IP to match your development machine's local IP address
  // You can find it by running: hostname -I (Linux) or ipconfig getifaddr en0 (Mac)
  return 'http://192.168.4.38:3000';
};
