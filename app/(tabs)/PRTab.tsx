import PRSummaryCards from '@/components/analytics/PRSummaryCards';
import { useEffectiveColorScheme } from '@/components/theme';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { Colors } from '@/constants/Colors';
import { workoutRepository } from '@/data/WorkoutRepositoryManager';
import { PRMetric } from '@/utils/pr/calculatePRMetrics';
import { WorkoutSession } from '@/utils/workoutSessions';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const PRTab: React.FC = () => {
  const colorScheme = useEffectiveColorScheme();
  const [prMetrics, setPRMetrics] = useState<PRMetric[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const calculatePRMetrics = (sessions: WorkoutSession[]): PRMetric[] => {
    const prMetrics: Record<string, PRMetric> = {};
    sessions.forEach(session => {
      session.exercises.forEach(ex => {
        ex.sets.forEach((set) => {
          const weight = parseFloat(set.weightText.replace(/[^\d.]/g, "")) || 0;
          const reps = set.reps || 0;
          const key = ex.nameRaw.toLowerCase();
          if (
            !prMetrics[key] ||
            weight > prMetrics[key].maxWeight ||
            (weight === prMetrics[key].maxWeight && reps > prMetrics[key].reps)
          ) {
            prMetrics[key] = {
              exercise: ex.nameRaw,
              maxWeight: weight,
              reps: reps,
              date: session.performedOn,
            };
          }
        });
      });
    });
    return Object.values(prMetrics).sort((a, b) => a.exercise.localeCompare(b.exercise));
  };

  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const sessions = await workoutRepository.listSessions();
          console.log('[PRTab] Loaded sessions:', sessions?.length || 0);
          if (!sessions || sessions.length === 0) {
            setPRMetrics([]);
            return;
          }
          
          // Debug: Check if sessions have exercises and sets
          const sessionsWithData = sessions.filter(s => s.exercises && s.exercises.length > 0);
          console.log('[PRTab] Sessions with exercises:', sessionsWithData.length);
          const totalExercises = sessions.reduce((sum, s) => sum + (s.exercises?.length || 0), 0);
          const totalSets = sessions.reduce((sum, s) => 
            sum + s.exercises.reduce((exSum, ex) => exSum + (ex.sets?.length || 0), 0), 0
          );
          console.log('[PRTab] Total exercises:', totalExercises, 'Total sets:', totalSets);
          
          const computedPRMetrics = calculatePRMetrics(sessions);
          console.log('[PRTab] Computed PR metrics:', computedPRMetrics.length);
          setPRMetrics(computedPRMetrics);
        } catch (error) {
          console.error('Error loading sessions for PR Tab:', error);
          setPRMetrics([]);
        }
      })();
    }, [])
  );

  const filteredMetrics = useMemo(() => {
    if (!searchQuery.trim()) return prMetrics;
    return prMetrics.filter(metric =>
      metric.exercise.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery, prMetrics]);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 20 }}>
        <View className="mb-6">
          <Text variant="h1">PRs</Text>
          <Text variant="muted">Your personal records (All Time)</Text>
        </View>

        <View className="relative mb-6">
          <Input
            placeholder="Search exercises..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            className="pl-10"
          />
          <View className="absolute left-3 top-2.5">
            <Ionicons name="search" size={18} color={Colors[colorScheme].mutedForeground} />
          </View>
        </View>

        <PRSummaryCards prMetrics={filteredMetrics} period="All Time" />
      </ScrollView>
    </SafeAreaView>
  );
};

export default PRTab;
