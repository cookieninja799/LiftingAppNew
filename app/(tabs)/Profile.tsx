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
    createWorkoutBackup,
    parseWorkoutBackup,
    stringifyWorkoutBackup,
    BackupValidationError,
} from '../../utils/data/workoutBackup';
import { exportWorkoutBackup, importWorkoutBackup } from '../../utils/data/workoutFileIO';
import { workoutRepository } from '@/data/WorkoutRepositoryManager';
import { useAuth } from '@/providers/AuthProvider';
import { syncEngine } from '@/data/SyncEngine';
import { loadUserProfile } from '../../utils/helpers';
import {
  getSettings,
  saveSettings,
  getApiKey,
  saveApiKey,
  clearApiKey,
  AISettings,
  AIProvider,
  ExecutionMode,
} from '@/data/AISettingsRepository';
import { createProvider } from '@/ai/providers';
import { parseWorkoutText } from '@/ai/AIParser';
import { supabase } from '@/lib/supabase';

const themeOptions = [
  { label: 'System', value: 'system' },
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
];

const Profile: React.FC = () => {
  const colorScheme = useEffectiveColorScheme();
  const { preference, setPreference } = useThemeContext();
  const { user, signOut } = useAuth();
  // Defer the preference value to prevent rendering during theme transitions
  const deferredPreference = useDeferredValue(preference);
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  
  // AI Settings state
  const [aiSettings, setAiSettings] = useState<AISettings>({
    provider: 'openai',
    model: 'gpt-4o-mini',
    executionMode: 'byok',
    useTemplateMuscles: true,
    allowModelProvidedMuscles: false,
  });
  const [apiKey, setApiKey] = useState('');
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [testKeyResult, setTestKeyResult] = useState<{ success: boolean; message?: string } | null>(null);
  const [parsePreviewText, setParsePreviewText] = useState('');
  const [isParsingPreview, setIsParsingPreview] = useState(false);
  const [parsePreviewResult, setParsePreviewResult] = useState<any>(null);

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
      const syncTime = await syncEngine.getLastSyncTime();
      setLastSync(syncTime);
      
      // Load AI settings
      const settings = await getSettings();
      setAiSettings(settings);
      const key = await getApiKey(settings.provider, settings.model);
      if (key) {
        setApiKey(key);
      }
    };
    fetchProfile();
  }, []);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const result = await syncEngine.syncNow();
      const syncTime = await syncEngine.getLastSyncTime();
      setLastSync(syncTime);
      Alert.alert('Sync Complete', `Pushed ${result.pushed} and pulled ${result.pulled} changes.`);
    } catch (error) {
      console.error('Sync failed:', error);
      Alert.alert('Sync Failed', 'Could not sync with cloud. Check your connection.');
    } finally {
      setIsSyncing(false);
    }
  };

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
      const sessions = await workoutRepository.listSessions();
      
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
    const performImport = async () => {
      try {
        const jsonContent = await importWorkoutBackup();
        const backup = parseWorkoutBackup(jsonContent);
        
        // Import all sessions from backup
        for (const session of backup.workoutSessions) {
          await workoutRepository.upsertSession(session);
        }
        
        Alert.alert(
          'Success',
          `Imported ${backup.workoutSessions.length} workout session${backup.workoutSessions.length === 1 ? '' : 's'}.`
        );
      } catch (error) {
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
      const confirmed = window.confirm('This will replace all existing workouts. Continue?');
      if (confirmed) {
        await performImport();
      }
    } else {
      // Native: Use Alert.alert with callbacks
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
              const sessions = await workoutRepository.listSessions();
              for (const session of sessions) {
                  await workoutRepository.deleteSession(session.id);
              }
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

  // AI Settings handlers
  const handleSaveAISettings = async () => {
    try {
      await saveSettings(aiSettings);
      if (apiKey.trim()) {
        await saveApiKey(aiSettings.provider, aiSettings.model, apiKey.trim());
      }
      Alert.alert('Success', 'AI settings saved successfully!');
    } catch (error) {
      console.error('Failed to save AI settings:', error);
      Alert.alert('Error', 'Failed to save AI settings.');
    }
  };

  const handleTestKey = async () => {
    if (!apiKey.trim()) {
      Alert.alert('Error', 'Please enter an API key first.');
      return;
    }

    setIsTestingKey(true);
    setTestKeyResult(null);

    try {
      if (aiSettings.executionMode === 'hosted') {
        // Test hosted mode by calling health endpoint
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const accessToken = session?.access_token?.trim();

        if (!accessToken) {
          setTestKeyResult({
            success: false,
            message: 'No active session found. Please sign out and sign back in, then try again.',
          });
          return;
        }

        const invokeOptions: any = {
          body: { provider: aiSettings.provider, model: aiSettings.model, text: 'test' },
        };
        invokeOptions.headers = { Authorization: `Bearer ${accessToken}` };

        const { error } = await supabase.functions.invoke('parse-workout-text', invokeOptions);
        if (error) {
          // Try to surface useful Edge Function error JSON (e.g. { error, details, diag })
          const anyError: any = error as any;
          let extra = '';
          const ctx = anyError?.context;
          if (ctx) {
            try {
              // supabase-js may give context as:
              // - a Response
              // - { response: Response }
              // - { body: string }
              if (typeof ctx === 'string') {
                extra = ctx;
              } else if (typeof ctx?.body === 'string') {
                extra = ctx.body;
              } else if (typeof ctx?.text === 'function') {
                extra = await ctx.text();
              } else if (typeof ctx?.response?.text === 'function') {
                extra = await ctx.response.text();
              } else {
                extra = JSON.stringify(ctx);
              }
            } catch {
              // ignore
            }
          }
          setTestKeyResult({
            success: false,
            message: extra ? `${error.message} | ${extra}` : error.message,
          });
        } else {
          setTestKeyResult({ success: true, message: 'Hosted mode connection successful' });
        }
      } else {
        // Test BYOK mode
        const provider = createProvider(aiSettings.provider, aiSettings.model);
        const result = await provider.testKey(apiKey.trim());
        setTestKeyResult(result);
      }
    } catch (error) {
      setTestKeyResult({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsTestingKey(false);
    }
  };

  const handleParsePreview = async () => {
    if (!parsePreviewText.trim()) {
      Alert.alert('Error', 'Please enter workout text to parse.');
      return;
    }

    setIsParsingPreview(true);
    setParsePreviewResult(null);

    try {
      const result = await parseWorkoutText(parsePreviewText.trim(), {
        supabaseClient: supabase,
        storeRawText: true,
      });
      setParsePreviewResult(result);
    } catch (error) {
      setParsePreviewResult({
        exercises: [],
        warnings: [`Parse error: ${error instanceof Error ? error.message : 'Unknown error'}`],
        confidence: 'low',
      });
    } finally {
      setIsParsingPreview(false);
    }
  };

  const providerModels: Record<AIProvider, string[]> = {
    openai: ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    anthropic: ['claude-3-5-sonnet-20241022', 'claude-3-opus-20240229', 'claude-3-sonnet-20240229'],
    gemini: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-pro'],
  };

  // Get colors for icons based on current theme
  const primaryColor = Colors[colorScheme].primary;
  const mutedForegroundColor = Colors[colorScheme].mutedForeground;
  const destructiveColor = Colors[colorScheme].destructive;

  return (
    <SafeAreaView className="flex-1 bg-background">
      <Pressable className="flex-1" onPress={(e) => {
        // On web, don't dismiss keyboard if clicking on an input element or button
        if (Platform.OS === 'web') {
          const targetTag = (e?.nativeEvent?.target as HTMLElement)?.tagName;
          if (targetTag === 'INPUT' || targetTag === 'TEXTAREA' || targetTag === 'BUTTON') {
            return; // Don't dismiss keyboard when clicking on inputs or buttons
          }
        }
        Keyboard.dismiss();
      }}>
        <ScrollView 
          contentContainerStyle={{ padding: 20 }} 
          keyboardShouldPersistTaps="handled"
        >
          <View className="mb-6 flex-row items-center justify-between">
            <View>
              <Text variant="h1">Profile</Text>
              <Text variant="muted">Personalize your training experience</Text>
            </View>
            <Button 
              variant="outline" 
              size="sm" 
              onPress={signOut}
              className="border-destructive"
            >
              <Ionicons name="log-out-outline" size={18} color={destructiveColor} />
              <Text className="text-destructive ml-1">Sign Out</Text>
            </Button>
          </View>

          <Card className="mb-6 bg-primary/5 border-primary/20">
            <CardHeader className="flex-row items-center gap-3 py-3">
              <View className="bg-primary/20 p-2 rounded-full">
                <Ionicons name="person" size={20} color={primaryColor} />
              </View>
              <View className="flex-1">
                <Text className="font-bold">{user?.email}</Text>
                <Text variant="small" className="text-primary/70">Authenticated with Supabase</Text>
              </View>
              <Button 
                variant="ghost" 
                size="sm" 
                onPress={handleSync}
                disabled={isSyncing}
                className="flex-row items-center gap-2"
              >
                <Ionicons 
                  name="sync" 
                  size={18} 
                  color={primaryColor} 
                  className={isSyncing ? 'animate-spin' : ''} 
                />
                <Text variant="small" className="text-primary font-bold">Sync</Text>
              </Button>
            </CardHeader>
            <Separator className="bg-primary/10" />
            <CardContent className="py-2">
              <Text variant="small" className="text-center text-primary/60">
                Last synced: {lastSync ? new Date(lastSync).toLocaleString() : 'Never'}
              </Text>
            </CardContent>
          </Card>

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

          {/* AI Settings Card */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>AI Settings</CardTitle>
              <CardDescription>Configure AI provider and parsing options</CardDescription>
            </CardHeader>
            <CardContent className="gap-4">
              <View>
                <Text variant="small" className="mb-1.5 ml-1">Provider</Text>
                <SegmentedControl
                  options={[
                    { label: 'OpenAI', value: 'openai' },
                    { label: 'Anthropic', value: 'anthropic' },
                    { label: 'Gemini', value: 'gemini' },
                  ]}
                  value={aiSettings.provider}
                  onChange={(value) => {
                    setAiSettings({ ...aiSettings, provider: value as AIProvider });
                    setApiKey('');
                    setTestKeyResult(null);
                  }}
                />
              </View>

              <View>
                <Text variant="small" className="mb-1.5 ml-1">Model</Text>
                <View className="flex-row gap-2">
                  <View className="flex-1">
                    <Input
                      placeholder="Model name"
                      value={aiSettings.model}
                      onChangeText={(text) => setAiSettings({ ...aiSettings, model: text })}
                    />
                  </View>
                </View>
                <Text variant="small" className="text-muted-foreground mt-1 ml-1">
                  Suggested: {providerModels[aiSettings.provider].join(', ')}
                </Text>
              </View>

              <View>
                <Text variant="small" className="mb-1.5 ml-1">API Key</Text>
                <View className="flex-row gap-2">
                  <View className="flex-1">
                    <Input
                      placeholder="Enter API key"
                      secureTextEntry={!apiKeyVisible}
                      value={apiKey}
                      onChangeText={setApiKey}
                    />
                  </View>
                  <Button
                    variant="outline"
                    size="sm"
                    label={apiKeyVisible ? 'Hide' : 'Show'}
                    onPress={() => setApiKeyVisible(!apiKeyVisible)}
                  />
                </View>
              </View>

              <View>
                <Text variant="small" className="mb-1.5 ml-1">Execution Mode</Text>
                <SegmentedControl
                  options={[
                    { label: 'BYOK', value: 'byok' },
                    { label: 'Hosted', value: 'hosted' },
                  ]}
                  value={aiSettings.executionMode}
                  onChange={(value) => {
                    setAiSettings({ ...aiSettings, executionMode: value as ExecutionMode });
                    setTestKeyResult(null);
                  }}
                />
                <Text variant="small" className="text-muted-foreground mt-1 ml-1">
                  {aiSettings.executionMode === 'byok'
                    ? 'Device calls provider directly using your API key'
                    : 'Device calls Supabase Edge Function (server uses server key)'}
                </Text>
              </View>

              <View className="flex-row gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  label={isTestingKey ? 'Testing...' : 'Test Key'}
                  onPress={handleTestKey}
                  disabled={isTestingKey || !apiKey.trim()}
                  className="flex-1"
                />
                <Button
                  variant="default"
                  size="sm"
                  label="Save Settings"
                  onPress={handleSaveAISettings}
                  className="flex-1"
                />
              </View>

              {testKeyResult && (
                <View className={`p-3 rounded-md ${testKeyResult.success ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                  <Text className={testKeyResult.success ? 'text-green-600' : 'text-red-600'}>
                    {testKeyResult.success ? '✓ ' : '✗ '}
                    {testKeyResult.message || (testKeyResult.success ? 'Key is valid' : 'Key test failed')}
                  </Text>
                </View>
              )}

              <Separator />

              <View>
                <Text variant="small" className="mb-1.5 ml-1">Use Template Muscles (Recommended)</Text>
                <SegmentedControl
                  options={[
                    { label: 'ON', value: 'true' },
                    { label: 'OFF', value: 'false' },
                  ]}
                  value={String(aiSettings.useTemplateMuscles)}
                  onChange={(value) => {
                    setAiSettings({ ...aiSettings, useTemplateMuscles: value === 'true' });
                  }}
                />
              </View>

              <View>
                <Text variant="small" className="mb-1.5 ml-1">Allow Model-Provided Muscles (Advanced)</Text>
                <SegmentedControl
                  options={[
                    { label: 'OFF', value: 'false' },
                    { label: 'ON', value: 'true' },
                  ]}
                  value={String(aiSettings.allowModelProvidedMuscles)}
                  onChange={(value) => {
                    setAiSettings({ ...aiSettings, allowModelProvidedMuscles: value === 'true' });
                  }}
                />
              </View>

              <Separator />

              <View>
                <Text variant="small" className="mb-1.5 ml-1">Parse Preview</Text>
                <Input
                  multiline
                  numberOfLines={4}
                  placeholder="Enter workout text to test parsing..."
                  value={parsePreviewText}
                  onChangeText={setParsePreviewText}
                  className="min-h-[100px]"
                />
                <Button
                  variant="outline"
                  size="sm"
                  label={isParsingPreview ? 'Parsing...' : 'Run Parse'}
                  onPress={handleParsePreview}
                  disabled={isParsingPreview || !parsePreviewText.trim()}
                  className="mt-2"
                />
              </View>

              {parsePreviewResult && (
                <View className="gap-2">
                  <Text variant="small" className="font-bold">
                    Confidence: <Text className={parsePreviewResult.confidence === 'high' ? 'text-green-600' : 'text-yellow-600'}>{parsePreviewResult.confidence.toUpperCase()}</Text>
                  </Text>
                  {parsePreviewResult.warnings.length > 0 && (
                    <View>
                      <Text variant="small" className="font-bold mb-1">Warnings:</Text>
                      {parsePreviewResult.warnings.map((w: string, i: number) => (
                        <Text key={i} variant="small" className="text-yellow-600">• {w}</Text>
                      ))}
                    </View>
                  )}
                  {parsePreviewResult.exercises && parsePreviewResult.exercises.length > 0 && (
                    <View>
                      <Text variant="small" className="font-bold mb-1">
                        Parsed Exercises ({parsePreviewResult.exercises.length}):
                      </Text>
                      {parsePreviewResult.exercises.map((ex: any, i: number) => (
                        <Text key={i} variant="small" className="text-muted-foreground">
                          • {ex.exercise}: {ex.sets} sets, {ex.reps?.join(', ') || 'N/A'} reps
                        </Text>
                      ))}
                    </View>
                  )}
                  {parsePreviewResult.extractedJsonText && (
                    <View>
                      <Text variant="small" className="font-bold mb-1">Extracted JSON:</Text>
                      <Text variant="small" className="text-muted-foreground font-mono text-xs">
                        {parsePreviewResult.extractedJsonText.substring(0, 200)}
                        {parsePreviewResult.extractedJsonText.length > 200 ? '...' : ''}
                      </Text>
                    </View>
                  )}
                  {parsePreviewResult.aiTraceId && (
                    <Text variant="small" className="text-muted-foreground">
                      Trace ID: {parsePreviewResult.aiTraceId}
                    </Text>
                  )}
                </View>
              )}
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
