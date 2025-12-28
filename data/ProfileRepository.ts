import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

export interface UserProfile {
  userId?: string;
  email?: string;
  displayName?: string;
  age?: string;
  gender?: string;
  weight?: string;
  height?: string;
  updatedAt?: string;
}

const PROFILE_KEY = 'userProfile';

export class ProfileRepository {
  async getProfile(): Promise<UserProfile | null> {
    // 1. Try local first
    const localData = await AsyncStorage.getItem(PROFILE_KEY);
    let profile: UserProfile | null = localData ? JSON.parse(localData) : null;

    // 2. If no local or we want to refresh from cloud
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: cloudProfile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (!error && cloudProfile) {
        // Merge cloud data into local profile
        profile = {
          ...profile,
          userId: user.id,
          email: user.email,
          displayName: cloudProfile.display_name,
          updatedAt: cloudProfile.updated_at,
          // We keep age/weight/height if they were local and not in cloud yet
        };
        await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
      }
    }

    return profile;
  }

  async saveProfile(profile: UserProfile): Promise<void> {
    const now = new Date().toISOString();
    const updatedProfile = { ...profile, updatedAt: now };

    // 1. Save local
    await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(updatedProfile));

    // 2. Save cloud if authenticated
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { error } = await supabase
        .from('profiles')
        .upsert({
          user_id: user.id,
          email: user.email,
          display_name: profile.displayName,
          updated_at: now,
        });

      if (error) {
        console.error('Error saving profile to cloud:', error);
      }
    }
  }
}

export const profileRepository = new ProfileRepository();

