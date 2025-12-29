// utils/secureStore.ts
// Secure storage for sensitive data (API keys)

import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Prefix for web storage keys to avoid conflicts
const WEB_STORAGE_PREFIX = 'secure_';

/**
 * Sets a secret value in secure storage
 * @param alias - Unique identifier for the secret
 * @param value - The secret value to store
 */
export async function setSecret(alias: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    // Use AsyncStorage (which uses localStorage on web) for web platform
    try {
      await AsyncStorage.setItem(`${WEB_STORAGE_PREFIX}${alias}`, value);
    } catch (error) {
      console.error(`Failed to set secret for alias "${alias}":`, error);
      throw new Error(`Failed to store secret: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  } else {
    // Use SecureStore for native platforms (iOS/Android)
    try {
      await SecureStore.setItemAsync(alias, value);
    } catch (error) {
      console.error(`Failed to set secret for alias "${alias}":`, error);
      throw new Error(`Failed to store secret: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

/**
 * Gets a secret value from secure storage
 * @param alias - Unique identifier for the secret
 * @returns The secret value or null if not found
 */
export async function getSecret(alias: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    // Use AsyncStorage (which uses localStorage on web) for web platform
    try {
      return await AsyncStorage.getItem(`${WEB_STORAGE_PREFIX}${alias}`);
    } catch (error) {
      console.error(`Failed to get secret for alias "${alias}":`, error);
      return null;
    }
  } else {
    // Use SecureStore for native platforms (iOS/Android)
    try {
      return await SecureStore.getItemAsync(alias);
    } catch (error) {
      console.error(`Failed to get secret for alias "${alias}":`, error);
      return null;
    }
  }
}

/**
 * Deletes a secret value from secure storage
 * @param alias - Unique identifier for the secret
 */
export async function deleteSecret(alias: string): Promise<void> {
  if (Platform.OS === 'web') {
    // Use AsyncStorage for web platform
    try {
      await AsyncStorage.removeItem(`${WEB_STORAGE_PREFIX}${alias}`);
    } catch (error) {
      console.error(`Failed to delete secret for alias "${alias}":`, error);
      // Don't throw - deletion failures are usually non-critical
    }
  } else {
    // Use SecureStore for native platforms (iOS/Android)
    try {
      await SecureStore.deleteItemAsync(alias);
    } catch (error) {
      console.error(`Failed to delete secret for alias "${alias}":`, error);
      // Don't throw - deletion failures are usually non-critical
    }
  }
}

