//RecordWorkout.tsx - Phase 4: Unified AI Screen (Log/Ask/Plan)
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
import { SegmentedControl } from '@/components/ui/segmented-control';
import { WorkoutSession, mergeExercisesIntoSessions, sortSessionsByDateDesc } from '@/utils/workoutSessions';
import { workoutRepository } from '@/data/WorkoutRepositoryManager';
import { parseWorkoutText } from '@/ai/AIParser';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import { getSettings, saveSettings, AIMode } from '@/data/AISettingsRepository';
import { parseIntent } from '@/ai/intents/intentParser';
import { AskIntentSchema } from '@/ai/intents/askSchema';
import { PlanIntentSchema } from '@/ai/intents/planSchema';
import { ASK_INTENT_SYSTEM_PROMPT, PLAN_INTENT_SYSTEM_PROMPT } from '@/ai/intents/prompts';
import { executeAskIntent, AskResult } from '@/ai/intents/askExecutor';
import { executePlanIntent, WorkoutPlan } from '@/ai/intents/planExecutor';
import { formatAskResult } from '@/ai/intents/askFormat';
import { needsLLMResponse, generateConversationalResponse } from '@/ai/intents/askConversational';

export default function RecordWorkout() {
  const colorScheme = useEffectiveColorScheme();
  const router = useRouter();
  const [input, setInput] = useState('');
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<AIMode>('log');
  const [askResult, setAskResult] = useState<{ answerText: string; dataCard: any; suggestions?: string[] } | null>(null);
  const [planResult, setPlanResult] = useState<WorkoutPlan | null>(null);

  // Load mode from settings
  useEffect(() => {
    const loadMode = async () => {
      const settings = await getSettings();
      if (settings.uiMode) {
        setMode(settings.uiMode);
      }
    };
    loadMode();
  }, []);

  // Save mode to settings when changed
  const handleModeChange = async (newMode: string) => {
    const modeValue = newMode as AIMode;
    setMode(modeValue);
    const settings = await getSettings();
    await saveSettings({ ...settings, uiMode: modeValue });
    // Clear results when switching modes
    setAskResult(null);
    setPlanResult(null);
    setInput('');
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

  const handleAsk = async () => {
    if (!input.trim()) {
      Alert.alert('Error', 'Please enter a question.');
      return;
    }

    setIsLoading(true);
    setAskResult(null);
    try {
      // Parse intent
      const intentResult = await parseIntent(
        input.trim(),
        'ask_intent',
        ASK_INTENT_SYSTEM_PROMPT,
        AskIntentSchema,
        { supabaseClient: supabase }
      );

      if (!intentResult.success || !intentResult.intent) {
        Alert.alert('Error', intentResult.error || 'Could not understand your question. Try rephrasing it.');
        setIsLoading(false);
        return;
      }

      // Execute intent
      let result = await executeAskIntent(intentResult.intent, sessions);
      
      // If the result needs an LLM response (conversational intents), generate it
      if (needsLLMResponse(result)) {
        result = await generateConversationalResponse(result, { supabaseClient: supabase });
      }
      
      const formatted = formatAskResult(result);
      setAskResult(formatted);
      setInput('');
    } catch (error) {
      console.error('Error processing ask:', error);
      Alert.alert('Error', `Failed to process question: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlan = async () => {
    if (!input.trim()) {
      Alert.alert('Error', 'Please enter a workout planning request.');
      return;
    }

    setIsLoading(true);
    setPlanResult(null);
    try {
      // Parse intent
      const intentResult = await parseIntent(
        input.trim(),
        'plan_intent',
        PLAN_INTENT_SYSTEM_PROMPT,
        PlanIntentSchema,
        { supabaseClient: supabase }
      );

      if (!intentResult.success || !intentResult.intent) {
        Alert.alert('Error', intentResult.error || 'Could not understand your planning request. Try rephrasing it.');
        setIsLoading(false);
        return;
      }

      // Execute intent
      const plan = await executePlanIntent(intentResult.intent, sessions);
      setPlanResult(plan);
      setInput('');
    } catch (error) {
      console.error('Error processing plan:', error);
      Alert.alert('Error', `Failed to generate plan: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUsePlan = () => {
    if (!planResult) return;
    // Switch to Log mode and prefill input with plan exercises
    const planText = planResult.exercises.map(ex => 
      `${ex.exercise} ${ex.sets}x${ex.reps}${ex.intensity ? ` @ ${ex.intensity}` : ''}`
    ).join(', ');
    setMode('log');
    setInput(planText);
    setPlanResult(null);
  };

  const handleSubmit = () => {
    if (mode === 'log') {
      handleLogWorkout();
    } else if (mode === 'ask') {
      handleAsk();
    } else if (mode === 'plan') {
      handlePlan();
    }
  };

  const getPlaceholder = () => {
    if (mode === 'log') {
      return 'e.g., Squats 3x10 @ 75 lbs, Bench Press 3x8 @ 135';
    } else if (mode === 'ask') {
      return 'e.g., When was the last time I benched?';
    } else {
      return 'e.g., Give me an upper body hypertrophy workout';
    }
  };

  const getButtonLabel = () => {
    if (isLoading) {
      if (mode === 'log') return 'Parsing...';
      if (mode === 'ask') return 'Searching...';
      return 'Planning...';
    }
    if (mode === 'log') return 'Log Workout';
    if (mode === 'ask') return 'Ask';
    return 'Generate Plan';
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <View className="mb-8">
          <Text variant="h1">AI Assistant</Text>
          <Text variant="muted">Log workouts, ask questions, or get plans</Text>
        </View>

        {/* Mode Selector */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <SegmentedControl
              options={[
                { label: 'Log', value: 'log' },
                { label: 'Ask', value: 'ask' },
                { label: 'Plan', value: 'plan' },
              ]}
              value={mode}
              onChange={handleModeChange}
            />
          </CardContent>
        </Card>

        {/* Input Card */}
        <Card className="mb-6 shadow-sm">
          <CardHeader>
            <CardTitle>
              {mode === 'log' ? 'Log Workout' : mode === 'ask' ? 'Ask Question' : 'Generate Plan'}
            </CardTitle>
            <CardDescription>
              {mode === 'log' 
                ? 'Describe your session in natural language. We\'ll handle the parsing.'
                : mode === 'ask'
                ? 'Ask about your workout history, PRs, or progress.'
                : 'Request a workout plan based on your training history.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="gap-4">
            <Input
              multiline
              numberOfLines={4}
              placeholder={getPlaceholder()}
              value={input}
              onChangeText={setInput}
              className="min-h-[120px] text-base py-3"
            />
            <Button 
              label={getButtonLabel()} 
              onPress={handleSubmit} 
              disabled={isLoading || !input.trim()}
              className="w-full"
            />
            {isLoading && (
              <View className="flex-row items-center justify-center gap-2 mt-2">
                <ActivityIndicator size="small" color={Colors[colorScheme].primary} />
                <Text variant="muted">
                  {mode === 'log' ? 'Analyzing your session...' : mode === 'ask' ? 'Searching your history...' : 'Generating plan...'}
                </Text>
              </View>
            )}
          </CardContent>
        </Card>

        {/* Ask Results */}
        {askResult && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Answer</CardTitle>
            </CardHeader>
            <CardContent>
              <Text className="mb-4">{askResult.answerText}</Text>
              {askResult.suggestions && askResult.suggestions.length > 0 && !askResult.dataCard && (
                <View className="mt-2">
                  <Text variant="small" className="text-muted-foreground mb-2">Try asking about:</Text>
                  {askResult.suggestions.map((suggestion: string, idx: number) => (
                    <Badge key={idx} variant="outline" label={suggestion} className="mr-2 mb-2" />
                  ))}
                </View>
              )}
              {askResult.dataCard && (
                <View className="border-t pt-4 mt-4">
                  <Text variant="small" className="font-bold mb-2">{askResult.dataCard.title}</Text>
                  {askResult.dataCard.items.map((item: any, idx: number) => (
                    <View key={idx} className="flex-row justify-between py-1">
                      <Text variant="small" className="text-muted-foreground">{item.label}:</Text>
                      <Text variant="small">{item.value}</Text>
                    </View>
                  ))}
                </View>
              )}
            </CardContent>
          </Card>
        )}

        {/* Plan Results */}
        {planResult && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>{planResult.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <View className="mb-4">
                {planResult.rationale.map((r, idx) => (
                  <Text key={idx} variant="small" className="mb-1">{r}</Text>
                ))}
              </View>
              <Separator className="my-4" />
              <View className="mb-4">
                <Text variant="small" className="font-bold mb-2">Exercises:</Text>
                {planResult.exercises.map((ex, idx) => (
                  <View key={idx} className="mb-2 pb-2 border-b last:border-0">
                    <Text className="font-medium">{ex.exercise}</Text>
                    <Text variant="small" className="text-muted-foreground">
                      {ex.sets} sets × {ex.reps} reps {ex.intensity && `@ ${ex.intensity}`}
                    </Text>
                    {ex.notes && (
                      <Text variant="small" className="text-muted-foreground italic">{ex.notes}</Text>
                    )}
                  </View>
                ))}
              </View>
              <Button
                label="Use This Plan"
                onPress={handleUsePlan}
                className="w-full"
              />
            </CardContent>
          </Card>
        )}

        {/* Recent Sessions (only show in Log mode) */}
        {mode === 'log' && (
          <>
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
                  .map((session) => (
                    <Card key={session.id}>
                      <CardHeader className="flex-row items-center justify-between py-3">
                        <Text className="font-bold">{new Date(session.performedOn).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</Text>
                        <Badge variant="secondary" label={`${session.exercises.length} exercises`} />
                      </CardHeader>
                      <Separator />
                      <CardContent className="py-3 gap-2">
                        {session.exercises.map((ex) => (
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
          </>
        )}
      </ScrollView>
      <StatusBar style={Platform.OS === 'ios' ? (colorScheme === 'dark' ? 'light' : 'dark') : 'auto'} />
    </SafeAreaView>
  );
}
