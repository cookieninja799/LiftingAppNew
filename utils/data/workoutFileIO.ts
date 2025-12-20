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
  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/273bebc2-49d2-4e67-aa1c-1b6f54b489ea',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'workoutFileIO.ts:58',message:'importWorkoutBackup entry',data:{platform:Platform.OS},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'E'})}).catch(()=>{});
  // #endregion
  if (Platform.OS === 'web') {
    // Web: Use file input
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      
      input.onchange = (event) => {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (!file) {
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/273bebc2-49d2-4e67-aa1c-1b6f54b489ea',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'workoutFileIO.ts:68',message:'Web: No file selected',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
          // #endregion
          reject(new Error('No file selected'));
          return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
          const content = e.target?.result as string;
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/273bebc2-49d2-4e67-aa1c-1b6f54b489ea',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'workoutFileIO.ts:75',message:'Web: File read success',data:{contentLength:content?.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'B'})}).catch(()=>{});
          // #endregion
          resolve(content);
        };
        reader.onerror = () => {
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/273bebc2-49d2-4e67-aa1c-1b6f54b489ea',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'workoutFileIO.ts:78',message:'Web: FileReader error',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
          // #endregion
          reject(new Error('Failed to read file'));
        };
        reader.readAsText(file);
      };

      input.oncancel = () => {
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/273bebc2-49d2-4e67-aa1c-1b6f54b489ea',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'workoutFileIO.ts:84',message:'Web: File selection cancelled',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        reject(new Error('File selection cancelled'));
      };

      input.click();
    });
  } else {
    // Native: Use DocumentPicker
    try {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/273bebc2-49d2-4e67-aa1c-1b6f54b489ea',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'workoutFileIO.ts:93',message:'Native: Calling DocumentPicker',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/273bebc2-49d2-4e67-aa1c-1b6f54b489ea',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'workoutFileIO.ts:98',message:'Native: DocumentPicker result',data:{canceled:result.canceled,assetCount:result.assets?.length,firstAssetUri:result.assets?.[0]?.uri},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'A'})}).catch(()=>{});
      // #endregion

      if (result.canceled) {
        throw new Error('File selection cancelled');
      }

      const fileUri = result.assets[0].uri;
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/273bebc2-49d2-4e67-aa1c-1b6f54b489ea',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'workoutFileIO.ts:102',message:'Native: Reading file',data:{fileUri},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      const content = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.UTF8,
      } as any);
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/273bebc2-49d2-4e67-aa1c-1b6f54b489ea',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'workoutFileIO.ts:105',message:'Native: File read success',data:{contentLength:content?.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'B'})}).catch(()=>{});
      // #endregion

      return content;
    } catch (error) {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/273bebc2-49d2-4e67-aa1c-1b6f54b489ea',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'workoutFileIO.ts:109',message:'Native: File read error',data:{errorType:error?.constructor?.name,errorMessage:error instanceof Error ? error.message : String(error)},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      console.error('Failed to import backup:', error);
      throw error;
    }
  }
}
