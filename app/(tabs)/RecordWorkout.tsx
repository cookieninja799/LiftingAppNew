//RecordWorkout.tsx
import { useEffectiveColorScheme } from '@/components/theme';
import { Colors } from '@/constants/Colors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import axios from 'axios';
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
import { Exercise, WorkoutSession } from '@/utils/workoutSessions';

type ParsedExercise = {
  id: string;
  date?: string;
  exercise?: string;
  sets?: number;
  reps?: number[];
  weights?: string[];
  primaryMuscleGroup?: string;
};

export default function RecordWorkout() {
  const colorScheme = useEffectiveColorScheme();
  const [input, setInput] = useState('');
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const getTodayDate = (): string => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const generateId = (): string =>
    Date.now().toString() + Math.random().toString(36).substring(2, 8);

  useEffect(() => {
    const initializeThread = async () => {
      setIsLoading(true);
      const apiBaseUrl = getApiBaseUrl();
      const apiUrl = `${apiBaseUrl}/thread`;
      try {
        const response = await axios.get(apiUrl, {
          timeout: 10000, // 10 second timeout
        });
        setThreadId(response.data.threadId);
      } catch (error: any) {
        console.error('Failed to create thread:', error);
        Alert.alert('Connection Error', `Unable to connect to server at ${apiBaseUrl}. Please check:\n1. Server is running\n2. Device and server are on the same network\n3. IP address is correct`);
      } finally {
        setIsLoading(false);
      }
    };
    initializeThread();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      const loadSessions = async () => {
        try {
          const storedSessions = await AsyncStorage.getItem('workoutSessions');
          if (storedSessions) {
            setSessions(JSON.parse(storedSessions));
          }
        } catch (error) {
          console.error('Failed to load workout sessions:', error);
        }
      };
      loadSessions();
    }, [])
  );

  const saveSessions = async (updatedSessions: WorkoutSession[]) => {
    try {
      await AsyncStorage.setItem('workoutSessions', JSON.stringify(updatedSessions));
    } catch (error) {
      console.error('Failed to save workout sessions:', error);
    }
  };

  const parseInputWithAssistant = async (userInput: string): Promise<ParsedExercise[] | null> => {
    if (!threadId) {
      Alert.alert('Error', 'Thread not initialized. Please wait a moment and try again.');
      return null;
    }
    try {
      const apiBaseUrl = getApiBaseUrl();
      const response = await axios.post(`${apiBaseUrl}/message`, {
        threadId,
        message: userInput,
      });

      const jsonMessages = response.data?.messages?.flat()?.filter((msg: any) => {
        const trimmed = msg?.text?.value?.trim();
        return msg?.type === 'text' && (trimmed.startsWith('{') || trimmed.startsWith('['));
      });

      if (!jsonMessages.length) {
        console.error('No valid JSON messages found in response:', response.data);
        Alert.alert('Error', 'Unexpected response format. Please try again.');
        return null;
      }

      const parsedExercises: ParsedExercise[] = [];

      jsonMessages.forEach((msg: any) => {
        try {
          const trimmedText = msg.text.value.trim();
          const parsed = JSON.parse(trimmedText);

          if (Array.isArray(parsed)) {
            parsed.forEach((exercise: any) => {
              parsedExercises.push({
                id: generateId(),
                date: exercise.date || getTodayDate(),
                exercise: exercise.exercise || 'Unknown Exercise',
                sets: exercise.sets || 1,
                reps: Array.isArray(exercise.reps) ? exercise.reps : [],
                weights: Array.isArray(exercise.weights) ? exercise.weights : [],
                primaryMuscleGroup: exercise.primaryMuscleGroup,
              });
            });
          } else if (parsed.exercises && Array.isArray(parsed.exercises)) {
            parsed.exercises.forEach((exercise: any) => {
              parsedExercises.push({
                id: generateId(),
                date: exercise.date || getTodayDate(),
                exercise: exercise.exercise || 'Unknown Exercise',
                sets: exercise.sets || 1,
                reps: Array.isArray(exercise.reps) ? exercise.reps : [],
                weights: Array.isArray(exercise.weights) ? exercise.weights : [],
                primaryMuscleGroup: exercise.primaryMuscleGroup,
              });
            });
          } else {
            parsedExercises.push({
              id: generateId(),
              date: parsed.date || getTodayDate(),
              exercise: parsed.exercise || 'Unknown Exercise',
              sets: parsed.sets || 1,
              reps: Array.isArray(parsed.reps) ? parsed.reps : [],
              weights: Array.isArray(parsed.weights) ? parsed.weights : [],
              primaryMuscleGroup: parsed.primaryMuscleGroup,
            });
          }
        } catch (error) {
          console.error('Error parsing JSON response:', error);
        }
      });

      return parsedExercises;
    } catch (error) {
      console.error('Error parsing input with assistant:', error);
      Alert.alert('Error', 'Failed to parse input. Please try again.');
      return null;
    }
  };

  const handleLogWorkout = async () => {
    if (!input.trim()) {
      Alert.alert('Error', 'Please enter a valid workout description.');
      return;
    }

    setIsLoading(true);
    const parsedExercises = await parseInputWithAssistant(input.trim());
    setIsLoading(false);

    if (parsedExercises && parsedExercises.length > 0) {
      let updatedSessions = [...sessions];

      parsedExercises.forEach(parsedResult => {
        const sessionDate = parsedResult.date!;
        const newExercise: Exercise = {
          id: parsedResult.id,
          exercise: parsedResult.exercise!,
          sets: parsedResult.sets!,
          reps: parsedResult.reps || [],
          weights: parsedResult.weights || [],
          primaryMuscleGroup: parsedResult.primaryMuscleGroup,
        };

        const existingSessionIndex = updatedSessions.findIndex(session => session.date === sessionDate);
        if (existingSessionIndex !== -1) {
          updatedSessions[existingSessionIndex].exercises.push(newExercise);
        } else {
          updatedSessions.push({
            id: generateId(),
            date: sessionDate,
            exercises: [newExercise],
          });
        }
      });

      setSessions(updatedSessions);
      saveSessions(updatedSessions);
      setInput('');
    } else {
      Alert.alert('Error', 'Failed to log workout.');
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
            sessions
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
              .slice(0, 5)
              .map((session, idx) => (
                <Card key={session.id}>
                  <CardHeader className="flex-row items-center justify-between py-3">
                    <Text className="font-bold">{new Date(session.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</Text>
                    <Badge variant="secondary" label={`${session.exercises.length} exercises`} />
                  </CardHeader>
                  <Separator />
                  <CardContent className="py-3 gap-2">
                    {session.exercises.map((ex, exIdx) => (
                      <View key={ex.id} className="flex-row items-center justify-between">
                        <View className="flex-1">
                          <Text className="font-medium">{ex.exercise}</Text>
                          <Text variant="muted" className="text-xs">
                            {ex.sets} sets • {ex.reps.join(', ')} reps
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
