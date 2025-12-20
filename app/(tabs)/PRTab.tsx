import { useEffectiveColorScheme } from '@/components/theme';
import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import PRSummaryCards, { PRMetric } from '../../components/analytics/PRSummaryCards';
import { WorkoutSession } from '../../utils/workoutSessions';

const PRTab: React.FC = () => {
  const colorScheme = useEffectiveColorScheme();
  const [prMetrics, setPRMetrics] = useState<PRMetric[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const calculatePRMetrics = (sessions: WorkoutSession[]): PRMetric[] => {
    const prMetrics: Record<string, PRMetric> = {};
    sessions.forEach(session => {
      session.exercises.forEach(ex => {
        ex.weights.forEach((weightStr, i) => {
          const weight = parseFloat(weightStr) || 0;
          const reps = ex.reps[i] || 0;
          const key = ex.exercise.toLowerCase();
          if (
            !prMetrics[key] ||
            weight > prMetrics[key].maxWeight ||
            (weight === prMetrics[key].maxWeight && reps > prMetrics[key].reps)
          ) {
            prMetrics[key] = {
              exercise: ex.exercise,
              maxWeight: weight,
              reps: reps,
              date: session.date,
            };
          }
        });
      });
    });
    return Object.values(prMetrics).sort((a, b) => a.exercise.localeCompare(b.exercise));
  };

  // Using useEffect instead of useFocusEffect to avoid navigation context requirement
  // Tabs stay mounted, so useEffect will work fine for loading data
  useEffect(() => {
    (async () => {
      try {
        const storedSessions = await AsyncStorage.getItem('workoutSessions');
        if (!storedSessions) return;
        const sessions: WorkoutSession[] = JSON.parse(storedSessions);
        const computedPRMetrics = calculatePRMetrics(sessions);
        setPRMetrics(computedPRMetrics);
      } catch (error) {
        console.error('Error loading sessions for PR Tab:', error);
      }
    })();
  }, []);

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
