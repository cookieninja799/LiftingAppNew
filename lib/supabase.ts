import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

// Custom storage to prevent "window is not defined" error during SSR/Node execution
// We use a memory storage in Node to prevent AsyncStorage (which uses localStorage on web) from crashing
const memoryStorage: Record<string, string> = {};

const customStorage = {
  getItem: (key: string) => {
    if (typeof window === 'undefined') {
      return memoryStorage[key] || null;
    }
    
    try {
      return AsyncStorage.getItem(key);
    } catch (e) {
      console.error('AsyncStorage.getItem error:', e);
      return null;
    }
  },
  setItem: (key: string, value: string) => {
    if (typeof window === 'undefined') {
      memoryStorage[key] = value;
      return;
    }
    
    try {
      return AsyncStorage.setItem(key, value);
    } catch (e) {
      console.error('AsyncStorage.setItem error:', e);
    }
  },
  removeItem: (key: string) => {
    if (typeof window === 'undefined') {
      delete memoryStorage[key];
      return;
    }
    
    try {
      return AsyncStorage.removeItem(key);
    } catch (e) {
      console.error('AsyncStorage.removeItem error:', e);
    }
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: customStorage as any,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

