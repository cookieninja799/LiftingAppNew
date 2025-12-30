// app/review-parsed-workout.tsx
// Review and edit screen for low-confidence parsed workouts

import { useEffectiveColorScheme } from '@/components/theme';
import { Colors } from '@/constants/Colors';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState, useEffect } from 'react';
import {
  Alert,
  ScrollView,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { Badge } from '@/components/ui/badge';
import { ParseResult } from '@/ai/AIParser';
import { ParsedExercise } from '@/utils/assistantParsing';
import { mergeExercisesIntoSessions } from '@/utils/workoutSessions';
import { workoutRepository } from '@/data/WorkoutRepositoryManager';
import { Ionicons } from '@expo/vector-icons';

export default function ReviewParsedWorkout() {
  const colorScheme = useEffectiveColorScheme();
  const router = useRouter();
  const params = useLocalSearchParams();
  
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [exercises, setExercises] = useState<ParsedExercise[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    try {
      if (params.parseResultJson) {
        const parsed = JSON.parse(params.parseResultJson as string);
        setParseResult(parsed);
        setExercises(parsed.exercises || []);
      }
      if (params.inputText) {
        setInputText(params.inputText as string);
      }
    } catch (error) {
      console.error('Failed to parse review params:', error);
      Alert.alert('Error', 'Failed to load parse result.');
      router.back();
    }
  }, [params]);

  const handleSave = async () => {
    if (exercises.length === 0) {
      Alert.alert('Error', 'No exercises to save.');
      return;
    }

    setIsSaving(true);
    try {
      // Load existing sessions
      const existingSessions = await workoutRepository.listSessions();
      
      // Merge exercises into sessions
      const updatedSessions = mergeExercisesIntoSessions(existingSessions, exercises);
      
      // Save all updated/new sessions
      for (const session of updatedSessions) {
        await workoutRepository.upsertSession(session);
      }

      Alert.alert('Success', `Saved ${exercises.length} exercise(s) successfully!`, [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    } catch (error) {
      console.error('Failed to save workout:', error);
      Alert.alert('Error', 'Failed to save workout.');
    } finally {
      setIsSaving(false);
    }
  };

  const updateExercise = (index: number, field: keyof ParsedExercise, value: any) => {
    const updated = [...exercises];
    updated[index] = { ...updated[index], [field]: value };
    setExercises(updated);
  };

  const updateReps = (exerciseIndex: number, repIndex: number, value: string) => {
    const updated = [...exercises];
    const reps = [...(updated[exerciseIndex].reps || [])];
    while (reps.length <= repIndex) {
      reps.push(0);
    }
    reps[repIndex] = parseInt(value) || 0;
    updated[exerciseIndex] = { ...updated[exerciseIndex], reps };
    setExercises(updated);
  };

  const updateWeights = (exerciseIndex: number, weightIndex: number, value: string) => {
    const updated = [...exercises];
    const weights = [...(updated[exerciseIndex].weights || [])];
    while (weights.length <= weightIndex) {
      weights.push('0');
    }
    weights[weightIndex] = value;
    updated[exerciseIndex] = { ...updated[exerciseIndex], weights };
    setExercises(updated);
  };

  const deleteExercise = (index: number) => {
    Alert.alert(
      'Delete Exercise',
      'Remove this exercise?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            const updated = exercises.filter((_, i) => i !== index);
            setExercises(updated);
          },
        },
      ]
    );
  };

  if (!parseResult) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center">
          <Text>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const primaryColor = Colors[colorScheme].primary;
  const destructiveColor = Colors[colorScheme].destructive;

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <View className="mb-6 flex-row items-center justify-between">
          <View>
            <Text variant="h1">Review Parsed Workout</Text>
            <Text variant="muted">Verify and edit before saving</Text>
          </View>
          <Button
            variant="ghost"
            size="sm"
            onPress={() => router.back()}
          >
            <Ionicons name="close" size={24} color={primaryColor} />
          </Button>
        </View>

        {/* Warnings and Confidence */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Parse Status</CardTitle>
          </CardHeader>
          <CardContent className="gap-2">
            <View className="flex-row items-center gap-2">
              <Text variant="small">Confidence:</Text>
              <Badge
                variant={parseResult.confidence === 'high' ? 'default' : 'secondary'}
                label={parseResult.confidence.toUpperCase()}
              />
            </View>
            {parseResult.warnings.length > 0 && (
              <View>
                <Text variant="small" className="font-bold mb-1">Warnings:</Text>
                {parseResult.warnings.map((warning, i) => (
                  <Text key={i} variant="small" className="text-yellow-600">
                    • {warning}
                  </Text>
                ))}
              </View>
            )}
          </CardContent>
        </Card>

        {/* Original Input */}
        {inputText && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Original Input</CardTitle>
            </CardHeader>
            <CardContent>
              <Text variant="small" className="text-muted-foreground">
                {inputText}
              </Text>
            </CardContent>
          </Card>
        )}

        {/* Extracted JSON Preview */}
        {parseResult.extractedJsonText && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Extracted JSON</CardTitle>
            </CardHeader>
            <CardContent>
              <Text variant="small" className="font-mono text-xs text-muted-foreground">
                {parseResult.extractedJsonText.substring(0, 500)}
                {parseResult.extractedJsonText.length > 500 ? '...' : ''}
              </Text>
            </CardContent>
          </Card>
        )}

        {/* Editable Exercises */}
        <View className="mb-6">
          <Text variant="h3" className="mb-4">Exercises ({exercises.length})</Text>
          {exercises.map((exercise, exIndex) => (
            <Card key={exIndex} className="mb-4">
              <CardHeader className="flex-row items-center justify-between">
                <View className="flex-1">
                  <Input
                    value={exercise.exercise}
                    onChangeText={(text) => updateExercise(exIndex, 'exercise', text)}
                    className="font-bold"
                  />
                </View>
                <Button
                  variant="ghost"
                  size="sm"
                  onPress={() => deleteExercise(exIndex)}
                >
                  <Ionicons name="trash-outline" size={20} color={destructiveColor} />
                </Button>
              </CardHeader>
              <Separator />
              <CardContent className="gap-3 pt-3">
                <View className="flex-row gap-2">
                  <View className="flex-1">
                    <Text variant="small" className="mb-1">Date</Text>
                    <Input
                      value={exercise.date}
                      onChangeText={(text) => updateExercise(exIndex, 'date', text)}
                      placeholder="YYYY-MM-DD"
                    />
                  </View>
                  <View className="flex-1">
                    <Text variant="small" className="mb-1">Sets</Text>
                    <Input
                      value={String(exercise.sets)}
                      onChangeText={(text) => updateExercise(exIndex, 'sets', parseInt(text) || 1)}
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                <View>
                  <Text variant="small" className="mb-2">Sets</Text>
                  {Array.from({ length: Math.max(exercise.sets || 1, exercise.reps?.length || 0, exercise.weights?.length || 0) }).map((_, setIndex) => (
                    <View key={setIndex} className="flex-row gap-2 mb-2">
                      <View className="flex-1">
                        <Text variant="small" className="mb-1">Reps</Text>
                        <Input
                          value={String(exercise.reps?.[setIndex] || 0)}
                          onChangeText={(text) => updateReps(exIndex, setIndex, text)}
                          keyboardType="numeric"
                          placeholder="0"
                        />
                      </View>
                      <View className="flex-1">
                        <Text variant="small" className="mb-1">Weight</Text>
                        <Input
                          value={exercise.weights?.[setIndex] || '0'}
                          onChangeText={(text) => updateWeights(exIndex, setIndex, text)}
                          placeholder="0"
                        />
                      </View>
                    </View>
                  ))}
                </View>
              </CardContent>
            </Card>
          ))}
        </View>

        {/* Action Buttons */}
        <View className="gap-2">
          <Button
            label={isSaving ? 'Saving...' : 'Save Workout'}
            onPress={handleSave}
            disabled={isSaving || exercises.length === 0}
            className="w-full"
          />
          <Button
            variant="outline"
            label="Cancel"
            onPress={() => router.back()}
            className="w-full"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

