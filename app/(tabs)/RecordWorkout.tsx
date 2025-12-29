//RecordWorkout.tsx
import { useEffectiveColorScheme } from '@/components/theme';
import { Colors } from '@/constants/Colors';
import { useFocusEffect } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Platform,
    ScrollView,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { getApiBaseUrl } from '@/utils/helpers';
import { WorkoutSession, mergeExercisesIntoSessions, sortSessionsByDateDesc } from '@/utils/workoutSessions';
import { workoutRepository } from '@/data/WorkoutRepositoryManager';
import { parseWorkoutText } from '@/ai/AIParser';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';

export default function RecordWorkout() {
  const colorScheme = useEffectiveColorScheme();
  const router = useRouter();
  const [input, setInput] = useState('');
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const getTodayDate = (): string => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };


  useFocusEffect(
    React.useCallback(() => {
      const loadSessions = async () => {
        try {
          const sessions = await workoutRepository.listSessions();
          setSessions(sessions);
        } catch (error) {
          console.error('Failed to load workout sessions:', error);
        }
      };
      loadSessions();
    }, [])
  );

  const handleLogWorkout = async () => {
    if (!input.trim()) {
      Alert.alert('Error', 'Please enter a valid workout description.');
      return;
    }

    setIsLoading(true);
    try {
      const parseResult = await parseWorkoutText(input.trim(), {
        supabaseClient: supabase,
        storeRawText: false,
      });

      if (!parseResult.exercises || parseResult.exercises.length === 0) {
        Alert.alert('Parse Error', parseResult.warnings.join('\n') || 'Failed to parse workout.');
        setIsLoading(false);
        return;
      }

      // Route to review screen if confidence is low or there are warnings
      if (parseResult.confidence === 'low' || parseResult.warnings.length > 0) {
        // Navigate to review screen with parse result
        router.push({
          pathname: '/review-parsed-workout',
          params: {
            parseResultJson: JSON.stringify(parseResult),
            inputText: input.trim(),
          },
        });
        setIsLoading(false);
        return;
      }

      // High confidence - merge and save directly
      const updatedSessions = mergeExercisesIntoSessions(sessions, parseResult.exercises);
      
      // Save all updated/new sessions
      for (const session of updatedSessions) {
        await workoutRepository.upsertSession(session);
      }

      setSessions(updatedSessions);
      setInput('');
      Alert.alert('Success', `Logged ${parseResult.exercises.length} exercise(s) successfully!`);
    } catch (error) {
      console.error('Error parsing workout:', error);
      Alert.alert('Error', `Failed to parse workout: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <View className="mb-8">
          <Text variant="h1">Record</Text>
          <Text variant="muted">Track your strength progress</Text>
        </View>

        <Card className="mb-10 shadow-sm">
          <CardHeader>
            <CardTitle>Log Workout</CardTitle>
            <CardDescription>
              Describe your session in natural language. We'll handle the parsing.
            </CardDescription>
          </CardHeader>
          <CardContent className="gap-4">
            <Input
              multiline
              numberOfLines={4}
              placeholder="e.g., Squats 3x10 @ 75 lbs, Bench Press 3x8 @ 135"
              value={input}
              onChangeText={setInput}
              className="min-h-[120px] text-base py-3"
            />
            <Button 
              label={isLoading ? "Parsing..." : "Log Workout"} 
              onPress={handleLogWorkout} 
              disabled={isLoading || !input.trim()}
              className="w-full"
            />
            {isLoading && (
              <View className="flex-row items-center justify-center gap-2 mt-2">
                <ActivityIndicator size="small" color={Colors[colorScheme].primary} />
                <Text variant="muted">Analyzing your session...</Text>
              </View>
            )}
          </CardContent>
        </Card>

        <View className="mb-4 mt-2 flex-row items-center justify-between">
          <Text variant="h3">Recent Sessions</Text>
        </View>

        <View className="gap-4">
          {sessions.length === 0 ? (
            <Card className="bg-muted/50 border-dashed">
              <CardContent className="items-center justify-center py-10">
                <Text variant="muted">No sessions recorded yet.</Text>
              </CardContent>
            </Card>
          ) : (
            sortSessionsByDateDesc(sessions)
              .slice(0, 5)
              .map((session, idx) => (
                <Card key={session.id}>
                  <CardHeader className="flex-row items-center justify-between py-3">
                    <Text className="font-bold">{new Date(session.performedOn).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</Text>
                    <Badge variant="secondary" label={`${session.exercises.length} exercises`} />
                  </CardHeader>
                  <Separator />
                  <CardContent className="py-3 gap-2">
                    {session.exercises.map((ex, exIdx) => (
                      <View key={ex.id} className="flex-row items-center justify-between">
                        <View className="flex-1">
                          <Text className="font-medium">{ex.nameRaw}</Text>
                          <Text variant="muted" className="text-xs">
                            {ex.sets.length} sets • {ex.sets.map(s => s.reps).join(', ')} reps
                          </Text>
                        </View>
                        {ex.primaryMuscleGroup && (
                          <Badge variant="outline" label={ex.primaryMuscleGroup} textClassName="text-[8px]" />
                        )}
                      </View>
                    ))}
                  </CardContent>
                </Card>
              ))
          )}
        </View>
      </ScrollView>
      <StatusBar style={Platform.OS === 'ios' ? (colorScheme === 'dark' ? 'light' : 'dark') : 'auto'} />
    </SafeAreaView>
  );
}
