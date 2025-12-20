import { ThemePreference, useEffectiveColorScheme, useThemeContext } from '@/components/theme';
import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { startTransition, useDeferredValue, useEffect, useState } from 'react';
import {
    Alert,
    Keyboard,
    Platform,
    Pressable,
    ScrollView,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { debugLog } from '@/lib/debugLogger';
import {
    BackupValidationError,
    createWorkoutBackup,
    parseWorkoutBackup,
    stringifyWorkoutBackup,
} from '../../utils/data/workoutBackup';
import { exportWorkoutBackup, importWorkoutBackup } from '../../utils/data/workoutFileIO';
import {
    clearWorkoutSessions,
    loadWorkoutSessions,
    saveWorkoutSessions,
} from '../../utils/data/workoutStorage';
import { loadUserProfile } from '../../utils/helpers';

const themeOptions = [
  { label: 'System', value: 'system' },
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
];

const Profile: React.FC = () => {
  const colorScheme = useEffectiveColorScheme();
  const { preference, setPreference } = useThemeContext();
  // Defer the preference value to prevent rendering during theme transitions
  const deferredPreference = useDeferredValue(preference);
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');

  useEffect(() => {
    const fetchProfile = async () => {
      const storedProfile = await AsyncStorage.getItem('userProfile');
      if (storedProfile) {
        const parsed = JSON.parse(storedProfile);
        setAge(parsed.age || '');
        setGender(parsed.gender || '');
        setWeight(parsed.weight || '');
        setHeight(parsed.height || '');
      }
    };
    fetchProfile();
  }, []);

  const handleSave = async () => {
    const profile = { age, gender, weight, height };
    try {
      await AsyncStorage.setItem('userProfile', JSON.stringify(profile));
      await loadUserProfile();
      Alert.alert('Success', 'Profile saved successfully!');
      Keyboard.dismiss();
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to save profile.');
    }
  };

  const handleExportWorkoutData = async () => {
    try {
      const sessions = await loadWorkoutSessions();
      
      if (sessions.length === 0) {
        Alert.alert('No Data', 'You have no workout data to export.');
        return;
      }

      const backup = createWorkoutBackup(sessions);
      const jsonContent = stringifyWorkoutBackup(backup);
      
      await exportWorkoutBackup(jsonContent);
      Alert.alert('Success', `Exported ${sessions.length} workout session${sessions.length === 1 ? '' : 's'}.`);
    } catch (error) {
      console.error('Export error:', error);
      Alert.alert('Export Failed', error instanceof Error ? error.message : 'Failed to export workout data.');
    }
  };

  const handleImportWorkoutData = async () => {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/273bebc2-49d2-4e67-aa1c-1b6f54b489ea',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Profile.tsx:97',message:'handleImportWorkoutData entry',data:{platform:Platform.OS},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    
    const performImport = async () => {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/273bebc2-49d2-4e67-aa1c-1b6f54b489ea',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Profile.tsx:100',message:'performImport called',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      try {
        const jsonContent = await importWorkoutBackup();
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/273bebc2-49d2-4e67-aa1c-1b6f54b489ea',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Profile.tsx:102',message:'importWorkoutBackup completed',data:{contentLength:jsonContent?.length,contentPreview:jsonContent?.substring(0,100)},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        const backup = parseWorkoutBackup(jsonContent);
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/273bebc2-49d2-4e67-aa1c-1b6f54b489ea',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Profile.tsx:103',message:'parseWorkoutBackup completed',data:{sessionCount:backup.workoutSessions.length,schemaVersion:backup.schemaVersion},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
        
        await saveWorkoutSessions(backup.workoutSessions);
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/273bebc2-49d2-4e67-aa1c-1b6f54b489ea',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Profile.tsx:105',message:'saveWorkoutSessions completed',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
        
        Alert.alert(
          'Success',
          `Imported ${backup.workoutSessions.length} workout session${backup.workoutSessions.length === 1 ? '' : 's'}.`
        );
      } catch (error) {
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/273bebc2-49d2-4e67-aa1c-1b6f54b489ea',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Profile.tsx:110',message:'Import error caught',data:{errorType:error?.constructor?.name,errorMessage:error instanceof Error ? error.message : String(error),isBackupValidationError:error instanceof BackupValidationError},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
        console.error('Import error:', error);
        if (error instanceof BackupValidationError) {
          Alert.alert('Import Failed', `Invalid backup file: ${error.message}`);
        } else {
          Alert.alert('Import Failed', error instanceof Error ? error.message : 'Failed to import workout data.');
        }
      }
    };

    // Web: Use window.confirm (Alert.alert callbacks don't work on web)
    if (Platform.OS === 'web') {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/273bebc2-49d2-4e67-aa1c-1b6f54b489ea',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Profile.tsx:119',message:'Web platform: using window.confirm',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      const confirmed = window.confirm('This will replace all existing workouts. Continue?');
      if (confirmed) {
        await performImport();
      }
    } else {
      // Native: Use Alert.alert with callbacks
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/273bebc2-49d2-4e67-aa1c-1b6f54b489ea',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Profile.tsx:124',message:'Native platform: using Alert.alert',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      Alert.alert(
        'Import Workout Data',
        'This will replace all existing workouts. Continue?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Import',
            style: 'destructive',
            onPress: performImport,
          },
        ]
      );
    }
  };

  const handleClearAllRecords = () => {
    Alert.alert(
      'Clear All Records',
      'Delete all workout history? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearWorkoutSessions();
              Alert.alert('Success', 'All workout records have been cleared.');
            } catch (error) {
              console.error('Clear error:', error);
              Alert.alert('Error', 'Failed to clear workout records.');
            }
          },
        },
      ]
    );
  };

  // Get colors for icons based on current theme
  const primaryColor = Colors[colorScheme].primary;
  const mutedForegroundColor = Colors[colorScheme].mutedForeground;
  const destructiveColor = Colors[colorScheme].destructive;

  return (
    <SafeAreaView className="flex-1 bg-background">
      <Pressable className="flex-1" onPress={Keyboard.dismiss}>
        <ScrollView 
          contentContainerStyle={{ padding: 20 }} 
          keyboardShouldPersistTaps="handled"
        >
          <View className="mb-6">
            <Text variant="h1">Profile</Text>
            <Text variant="muted">Personalize your training experience</Text>
          </View>

          {/* Theme Preference Card */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Appearance</CardTitle>
              <CardDescription>Choose how the app looks to you.</CardDescription>
            </CardHeader>
            <CardContent>
              <SegmentedControl
                options={themeOptions}
                value={deferredPreference}
              onChange={(value) => {
                // #region agent log
                  debugLog({
                    location: "app/(tabs)/Profile.tsx:214",
                    message: "Theme preference change requested",
                    data: { selected: value },
                    sessionId: "debug-session",
                    runId: "post-fix",
                    hypothesisId: "H3",
                  });
                // #endregion
                  console.log(`[H3] Theme preference change requested selected=${value}`);
                // Use startTransition to mark theme change as non-urgent
                // This prevents interrupting navigation context during renders
                startTransition(() => {
                  setPreference(value as ThemePreference);
                });
              }}
              />
            </CardContent>
          </Card>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Physical Stats</CardTitle>
              <CardDescription>Update your metrics for better analysis.</CardDescription>
            </CardHeader>
            <CardContent className="gap-4">
              <View className="flex-row gap-4">
                <View className="flex-1">
                  <Text variant="small" className="mb-1.5 ml-1">Age</Text>
                  <Input
                    placeholder="25"
                    keyboardType="numeric"
                    value={age}
                    onChangeText={setAge}
                  />
                </View>
                <View className="flex-1">
                  <Text variant="small" className="mb-1.5 ml-1">Gender</Text>
                  <Input
                    placeholder="M/F/X"
                    value={gender}
                    onChangeText={setGender}
                  />
                </View>
              </View>

              <View className="flex-row gap-4">
                <View className="flex-1">
                  <Text variant="small" className="mb-1.5 ml-1">Weight (lbs)</Text>
                  <Input
                    placeholder="185"
                    keyboardType="numeric"
                    value={weight}
                    onChangeText={setWeight}
                  />
                </View>
                <View className="flex-1">
                  <Text variant="small" className="mb-1.5 ml-1">Height (in)</Text>
                  <Input
                    placeholder="70"
                    keyboardType="numeric"
                    value={height}
                    onChangeText={setHeight}
                  />
                </View>
              </View>
              
              <Button label="Save Profile" onPress={handleSave} className="mt-2" />
            </CardContent>
          </Card>

          <View className="gap-4">
            <Text variant="h4" className="ml-1">Data Management</Text>
            <Card>
              <Pressable 
                className="p-4 flex-row items-center justify-between active:bg-accent/50"
                onPress={handleExportWorkoutData}
              >
                <View className="flex-row items-center gap-3">
                  <View className="bg-primary/10 p-2 rounded-full">
                    <Ionicons name="download-outline" size={20} color={primaryColor} />
                  </View>
                  <Text className="font-medium">Export Workout Data</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={mutedForegroundColor} />
              </Pressable>
              <Separator />
              <Pressable 
                className="p-4 flex-row items-center justify-between active:bg-accent/50"
                onPress={handleImportWorkoutData}
              >
                <View className="flex-row items-center gap-3">
                  <View className="bg-primary/10 p-2 rounded-full">
                    <Ionicons name="cloud-upload-outline" size={20} color={primaryColor} />
                  </View>
                  <Text className="font-medium">Import Workout Data</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={mutedForegroundColor} />
              </Pressable>
              <Separator />
              <Pressable 
                className="p-4 flex-row items-center justify-between active:bg-accent/50"
                onPress={handleClearAllRecords}
              >
                <View className="flex-row items-center gap-3">
                  <View className="bg-destructive/10 p-2 rounded-full">
                    <Ionicons name="trash-outline" size={20} color={destructiveColor} />
                  </View>
                  <Text className="font-medium text-destructive">Clear All Records</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={mutedForegroundColor} />
              </Pressable>
            </Card>
          </View>
        </ScrollView>
      </Pressable>
    </SafeAreaView>
  );
};

export default Profile;
