// utils/data/workoutFileIO.ts
// Platform-specific file I/O for workout backup export/import

import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

/**
 * Exports workout backup data to a file
 * @param jsonContent - JSON string content to export
 * @param filename - Optional filename (default: workout-backup-YYYY-MM-DD.json)
 */
export async function exportWorkoutBackup(jsonContent: string, filename?: string): Promise<void> {
  const defaultFilename = `workout-backup-${new Date().toISOString().split('T')[0]}.json`;
  const finalFilename = filename || defaultFilename;

  if (Platform.OS === 'web') {
    // Web: Use Blob download
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = finalFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } else {
    // Native: Write to cache directory and share
    const fileUri = `${FileSystem.cacheDirectory}${finalFilename}`;
    
    try {
      await FileSystem.writeAsStringAsync(fileUri, jsonContent, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/json',
          dialogTitle: 'Export Workout Data',
        });
      } else {
        throw new Error('Sharing is not available on this device');
      }
    } catch (error) {
      console.error('Failed to export backup:', error);
      throw error;
    }
  }
}

/**
 * Imports workout backup data from a file
 * @returns JSON string content from the selected file
 */
export async function importWorkoutBackup(): Promise<string> {
  if (Platform.OS === 'web') {
    // Web: Use file input
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      
      input.onchange = (event) => {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (!file) {
          reject(new Error('No file selected'));
          return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
          const content = e.target?.result as string;
          resolve(content);
        };
        reader.onerror = () => {
          reject(new Error('Failed to read file'));
        };
        reader.readAsText(file);
      };

      input.oncancel = () => {
        reject(new Error('File selection cancelled'));
      };

      input.click();
    });
  } else {
    // Native: Use DocumentPicker
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        throw new Error('File selection cancelled');
      }

      const fileUri = result.assets[0].uri;
      const content = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.UTF8,
      } as any);

      return content;
    } catch (error) {
      console.error('Failed to import backup:', error);
      throw error;
    }
  }
}






