// Logs.tsx
import { useEffectiveColorScheme } from '@/components/theme';
import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import {
    Alert,
    Modal,
    Pressable,
    ScrollView,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Fab } from '@/components/ui/fab';
import { Input } from '@/components/ui/input';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { getMonthFromDate, getWeekFromDate } from '../../utils/helpers';
import { WorkoutSession, WorkoutExercise, WorkoutSet, sortSessionsByDateDesc } from '../../utils/workoutSessions';
import { workoutRepository } from '@/data/WorkoutRepositoryManager';
import { defaultIdFactory } from '@/utils/assistantParsing';

// Group sessions using the provided helper functions.
const groupSessions = (
  sessions: WorkoutSession[],
  groupBy: 'week' | 'month'
) => {
  return sessions.reduce((acc, session) => {
    const key =
      groupBy === 'week'
        ? getWeekFromDate(session.performedOn)
        : getMonthFromDate(session.performedOn);
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(session);
    return acc;
  }, {} as Record<string, WorkoutSession[]>);
};

type EditPayload = {
  sessionId: string;
  exercise: WorkoutExercise;
};

export default function Logs() {
  const colorScheme = useEffectiveColorScheme();
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [currentEdit, setCurrentEdit] = useState<EditPayload | null>(null);

  const [editExerciseName, setEditExerciseName] = useState('');
  const [editSets, setEditSets] = useState('');
  const [editReps, setEditReps] = useState('');
  const [editWeights, setEditWeights] = useState('');
  const [editMuscleGroup, setEditMuscleGroup] = useState('');

  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [newDate, setNewDate] = useState('');
  const [newExerciseName, setNewExerciseName] = useState('');
  const [newSets, setNewSets] = useState('');
  const [newReps, setNewReps] = useState('');
  const [newWeights, setNewWeights] = useState('');
  const [newMuscleGroup, setNewMuscleGroup] = useState('');

  const [groupBy, setGroupBy] = useState<'week' | 'month'>('week');
  const [exerciseSuggestions, setExerciseSuggestions] = useState<string[]>([]);

  const allExercises = useMemo(() => {
    const exerciseSet = new Set<string>();
    sessions.forEach(session => {
      session.exercises.forEach(ex => {
        if (ex.nameRaw) exerciseSet.add(ex.nameRaw);
      });
    });
    return Array.from(exerciseSet);
  }, [sessions]);

  const handleNewExerciseNameChange = (text: string) => {
    setNewExerciseName(text);
    const filtered = allExercises.filter(ex =>
      ex.toLowerCase().includes(text.toLowerCase())
    );
    setExerciseSuggestions(filtered);
  };

  const handleSuggestionTap = (suggestion: string) => {
    setNewExerciseName(suggestion);
    setExerciseSuggestions([]);
  };

  useFocusEffect(
    useCallback(() => {
      const loadSessions = async () => {
        try {
          const fetchedSessions = await workoutRepository.listSessions();
          setSessions(fetchedSessions);
        } catch (error) {
          console.error('Failed to load sessions:', error);
        }
      };
      loadSessions();
    }, [])
  );

  const deleteExercise = async (sessionId: string, exerciseId: string) => {
    const session = await workoutRepository.getWorkoutSession(sessionId);
    if (!session) return;

    const updatedExercises = session.exercises.filter(ex => ex.id !== exerciseId);
    
    if (updatedExercises.length === 0) {
      await workoutRepository.softDeleteSession(sessionId);
    } else {
      await workoutRepository.upsertSession({
        ...session,
        exercises: updatedExercises,
      });
    }
    
    const fetchedSessions = await workoutRepository.listSessions();
    setSessions(fetchedSessions);
  };

  const confirmDeleteExercise = (sessionId: string, exerciseId: string) => {
    Alert.alert('Delete Exercise', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteExercise(sessionId, exerciseId) },
    ]);
  };

  const deleteSession = async (sessionId: string) => {
    await workoutRepository.softDeleteSession(sessionId);
    const fetchedSessions = await workoutRepository.listSessions();
    setSessions(fetchedSessions);
  };

  const confirmDeleteSession = (sessionId: string) => {
    Alert.alert('Delete Session', 'Delete entire log for this day?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteSession(sessionId) },
    ]);
  };

  const editExercise = (sessionId: string, exercise: WorkoutExercise) => {
    setCurrentEdit({ sessionId, exercise });
    setEditExerciseName(exercise.nameRaw);
    setEditSets(exercise.sets.length.toString());
    setEditReps(exercise.sets.map(s => s.reps).join(', '));
    setEditWeights(exercise.sets.map(s => s.weightText).join(', '));
    setEditMuscleGroup(exercise.primaryMuscleGroup || '');
  };

  const saveEditedExercise = async () => {
    if (!currentEdit) return;

    const now = new Date().toISOString();
    const repsArr = editReps ? editReps.split(',').map(rep => parseInt(rep.trim(), 10) || 0) : [];
    const weightsArr = editWeights ? editWeights.split(',').map(w => w.trim()) : [];
    const setCount = parseInt(editSets, 10) || 0;
    const finalSetCount = Math.max(repsArr.length, weightsArr.length, setCount);

    const updatedSets: WorkoutSet[] = [];
    for (let i = 0; i < finalSetCount; i++) {
      updatedSets.push({
        id: currentEdit.exercise.sets[i]?.id || defaultIdFactory(),
        exerciseId: currentEdit.exercise.id,
        setIndex: i,
        reps: repsArr[i] || 0,
        weightText: weightsArr[i] || '0',
        isBodyweight: false,
        updatedAt: now,
        createdAt: currentEdit.exercise.sets[i]?.createdAt || now,
      });
    }

    const updatedExercise: WorkoutExercise = {
      ...currentEdit.exercise,
      nameRaw: editExerciseName,
      sets: updatedSets,
      primaryMuscleGroup: editMuscleGroup || undefined,
      updatedAt: now,
    };

    const session = await workoutRepository.getWorkoutSession(currentEdit.sessionId);
    if (session) {
      await workoutRepository.upsertSession({
        ...session,
        exercises: session.exercises.map(ex =>
          ex.id === updatedExercise.id ? updatedExercise : ex
        ),
      });
    }

    const fetchedSessions = await workoutRepository.listSessions();
    setSessions(fetchedSessions);
    setCurrentEdit(null);
  };

  const saveNewExercise = async () => {
    if (!newExerciseName.trim()) return;
    const date = newDate.trim() || new Date().toISOString().split('T')[0];
    const now = new Date().toISOString();

    const repsArr = newReps ? newReps.split(',').map(rep => parseInt(rep.trim(), 10) || 0) : [];
    const weightsArr = newWeights ? newWeights.split(',').map(w => w.trim()) : [];
    const setCount = parseInt(newSets, 10) || 0;
    const finalSetCount = Math.max(repsArr.length, weightsArr.length, setCount);

    const exerciseId = defaultIdFactory();
    const newSetsArr: WorkoutSet[] = [];
    for (let i = 0; i < finalSetCount; i++) {
      newSetsArr.push({
        id: defaultIdFactory(),
        exerciseId,
        setIndex: i,
        reps: repsArr[i] || 0,
        weightText: weightsArr[i] || '0',
        isBodyweight: false,
        updatedAt: now,
        createdAt: now,
      });
    }

    const newExercise: WorkoutExercise = {
      id: exerciseId,
      sessionId: '', // Will be set below
      nameRaw: newExerciseName,
      sets: newSetsArr,
      primaryMuscleGroup: newMuscleGroup || undefined,
      updatedAt: now,
      createdAt: now,
    };

    let session = sessions.find(s => s.performedOn === date);
    if (session) {
      newExercise.sessionId = session.id;
      await workoutRepository.upsertSession({
        ...session,
        exercises: [...session.exercises, newExercise],
      });
    } else {
      const sessionId = defaultIdFactory();
      newExercise.sessionId = sessionId;
      await workoutRepository.upsertSession({
        id: sessionId,
        performedOn: date,
        exercises: [newExercise],
        updatedAt: now,
        createdAt: now,
        deletedAt: null,
      });
    }

    const fetchedSessions = await workoutRepository.listSessions();
    setSessions(fetchedSessions);
    setIsAddModalVisible(false);
    setNewExerciseName('');
  };

  const sortedSessions = useMemo(() => {
    return sortSessionsByDateDesc(sessions);
  }, [sessions]);

  const groupedSessions = useMemo(() => {
    return groupSessions(sortedSessions, groupBy);
  }, [sortedSessions, groupBy]);

  // Get colors for icons
  const destructiveColor = Colors[colorScheme].primary === Colors.dark.primary 
    ? '#7f1d1d' // dark destructive
    : '#ef4444'; // light destructive
  const mutedForegroundColor = Colors[colorScheme].mutedForeground;
  const primaryColor = Colors[colorScheme].primary;

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
        <View className="mb-6">
          <Text variant="h1">History</Text>
          <Text variant="muted">Review and edit your past workouts</Text>
        </View>

        <SegmentedControl
          options={[
            { label: 'Weekly', value: 'week' },
            { label: 'Monthly', value: 'month' },
          ]}
          value={groupBy}
          onChange={(v) => setGroupBy(v as any)}
          className="mb-8"
        />

        {Object.entries(groupedSessions).length > 0 ? (
          Object.entries(groupedSessions).map(([groupKey, sessionsInGroup]) => (
            <View key={groupKey} className="mb-8">
              <Text variant="h4" className="mb-4 text-primary">
                {groupBy === 'week' ? `Week ${groupKey}` : groupKey}
              </Text>
              <View className="gap-4">
                {sessionsInGroup.map(session => (
                  <Card key={session.id}>
                    <Pressable 
                      onPress={() => setExpandedSessionId(expandedSessionId === session.id ? null : session.id)}
                      className="p-4 flex-row items-center justify-between"
                    >
                      <View>
                        <Text className="font-bold text-lg">
                          {new Date(session.performedOn).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                        </Text>
                        <Text variant="muted">
                          {session.exercises.length} {session.exercises.length === 1 ? 'exercise' : 'exercises'}
                        </Text>
                      </View>
                      <View className="flex-row items-center gap-4">
                        <Pressable onPress={() => confirmDeleteSession(session.id)}>
                          <Ionicons name="trash-outline" size={20} color={destructiveColor} />
                        </Pressable>
                        <Ionicons 
                          name={expandedSessionId === session.id ? "chevron-up" : "chevron-down"} 
                          size={20} 
                          color={mutedForegroundColor} 
                        />
                      </View>
                    </Pressable>
                    
                    {expandedSessionId === session.id && (
                      <CardContent className="pt-0 pb-4 gap-4">
                        <Separator className="mb-2" />
                        {session.exercises.map(ex => (
                          <View key={ex.id} className="flex-row items-center justify-between">
                            <View className="flex-1">
                              <Text className="font-medium">{ex.nameRaw}</Text>
                              <Text variant="muted" className="text-sm">
                                {ex.sets.length} sets • {ex.sets.map(s => s.reps).join(', ')} reps
                              </Text>
                            </View>
                            <View className="flex-row items-center gap-2">
                              {ex.primaryMuscleGroup && (
                                <Badge variant="secondary" label={ex.primaryMuscleGroup} textClassName="text-[8px]" />
                              )}
                              <Button variant="ghost" size="icon" onPress={() => editExercise(session.id, ex)}>
                                <Ionicons name="pencil" size={16} color={primaryColor} />
                              </Button>
                              <Button variant="ghost" size="icon" onPress={() => confirmDeleteExercise(session.id, ex.id)}>
                                <Ionicons name="close-circle" size={16} color={destructiveColor} />
                              </Button>
                            </View>
                          </View>
                        ))}
                      </CardContent>
                    )}
                  </Card>
                ))}
              </View>
            </View>
          ))
        ) : (
          <Card className="bg-muted/50 border-dashed py-12">
            <CardContent className="items-center justify-center">
              <Text variant="muted" className="text-center">No logs found. Start by recording a workout!</Text>
            </CardContent>
          </Card>
        )}
      </ScrollView>

      <Fab iconName="add" onPress={() => setIsAddModalVisible(true)} />

      {/* Edit Exercise Modal */}
      <Modal visible={!!currentEdit} animationType="fade" transparent>
        <View className="flex-1 bg-black/50 justify-center p-6">
          <Card className="max-h-[80%]">
            <CardHeader>
              <CardTitle>Edit Exercise</CardTitle>
            </CardHeader>
            <ScrollView className="p-6 pt-0">
              <View className="gap-4">
                <View>
                  <Text variant="small" className="mb-1">Exercise Name</Text>
                  <Input value={editExerciseName} onChangeText={setEditExerciseName} />
                </View>
                <View className="flex-row gap-4">
                  <View className="flex-1">
                    <Text variant="small" className="mb-1">Sets</Text>
                    <Input value={editSets} onChangeText={setEditSets} keyboardType="numeric" />
                  </View>
                  <View className="flex-2">
                    <Text variant="small" className="mb-1">Muscle Group</Text>
                    <Input value={editMuscleGroup} onChangeText={setEditMuscleGroup} />
                  </View>
                </View>
                <View>
                  <Text variant="small" className="mb-1">Reps (comma-separated)</Text>
                  <Input value={editReps} onChangeText={setEditReps} placeholder="10, 8, 6" />
                </View>
                <View>
                  <Text variant="small" className="mb-1">Weights (comma-separated)</Text>
                  <Input value={editWeights} onChangeText={setEditWeights} placeholder="75, 80, 85" />
                </View>
              </View>
            </ScrollView>
            <CardFooter className="gap-2">
              <Button label="Save Changes" className="flex-1" onPress={saveEditedExercise} />
              <Button label="Cancel" variant="outline" onPress={() => setCurrentEdit(null)} />
            </CardFooter>
          </Card>
        </View>
      </Modal>

      {/* Add New Exercise Modal */}
      <Modal visible={isAddModalVisible} animationType="fade" transparent>
        <View className="flex-1 bg-black/50 justify-center p-6">
          <Card className="max-h-[80%]">
            <CardHeader>
              <CardTitle>Add Exercise</CardTitle>
            </CardHeader>
            <ScrollView className="p-6 pt-0">
              <View className="gap-4">
                <View>
                  <Text variant="small" className="mb-1">Date (YYYY-MM-DD)</Text>
                  <Input value={newDate} onChangeText={setNewDate} placeholder={new Date().toISOString().split('T')[0]} />
                </View>
                <View>
                  <Text variant="small" className="mb-1">Exercise Name</Text>
                  <Input value={newExerciseName} onChangeText={handleNewExerciseNameChange} />
                  {exerciseSuggestions.length > 0 && (
                    <View className="mt-1 border border-border rounded-md bg-muted p-1">
                      {exerciseSuggestions.slice(0, 3).map(s => (
                        <Pressable key={s} onPress={() => handleSuggestionTap(s)} className="p-2 border-b border-border last:border-0">
                          <Text variant="small">{s}</Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                </View>
                <View className="flex-row gap-4">
                  <View className="flex-1">
                    <Text variant="small" className="mb-1">Sets</Text>
                    <Input value={newSets} onChangeText={setNewSets} keyboardType="numeric" />
                  </View>
                  <View className="flex-2">
                    <Text variant="small" className="mb-1">Muscle Group</Text>
                    <Input value={newMuscleGroup} onChangeText={setNewMuscleGroup} />
                  </View>
                </View>
                <View>
                  <Text variant="small" className="mb-1">Reps (comma-separated)</Text>
                  <Input value={newReps} onChangeText={setNewReps} />
                </View>
                <View>
                  <Text variant="small" className="mb-1">Weights (comma-separated)</Text>
                  <Input value={newWeights} onChangeText={setNewWeights} />
                </View>
              </View>
            </ScrollView>
            <CardFooter className="gap-2">
              <Button label="Add Exercise" className="flex-1" onPress={saveNewExercise} />
              <Button label="Cancel" variant="outline" onPress={() => setIsAddModalVisible(false)} />
            </CardFooter>
          </Card>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
