// Analytics.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import CalendarHeatMap from '../../components/analytics/CalendarHeatMap';
import MuscleGroupStats from '../../components/analytics/MuscleGroupStats';
import StatsOverview from '../../components/analytics/StatsOverview';
import WorkoutLegend from '../../components/analytics/WorkoutLegend';
import { calculateStatsFromSessions, getEmptyStats, WorkoutStats } from '../../utils/analytics/calculateStats';
import { workoutRepository } from '../../data/WorkoutRepositoryManager';
import { loadUserProfile, getCurrentWeek } from '../../utils/helpers';

const Analytics: React.FC = () => {
  const [workoutStats, setWorkoutStats] = useState<WorkoutStats>(getEmptyStats());
  const [markedDates, setMarkedDates] = useState<Record<string, number>>({});

  const calculateStats = async () => {
    await loadUserProfile();
    try {
      const sessions = await workoutRepository.listSessions();
      console.log('[Analytics] Sessions loaded:', sessions?.length);
      if (sessions && sessions.length > 0) {
        console.log('[Analytics] Session dates:', sessions.map(s => s.performedOn));
        sessions.forEach(s => {
          console.log(`[Analytics] Session ${s.id}: date=${s.performedOn}, exercises=${s.exercises.length}`);
        });
      }
      
      if (!sessions || sessions.length === 0) {
        setWorkoutStats(getEmptyStats());
        setMarkedDates({});
        return;
      }
  
      const currentWeek = getCurrentWeek();
      
      const { workoutStats: stats, markedDates: dates } = calculateStatsFromSessions(
        sessions,
        { currentWeek }
      );
      
      console.log('[Analytics] Calculated markedDates:', dates);
  
      setWorkoutStats(stats);
      setMarkedDates(dates);
    } catch (error) {
      console.error('Failed to calculate stats:', error);
    }
  };
  
  useFocusEffect(
    useCallback(() => {
      calculateStats();
    }, [])
  );

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 20 }}>
        <View className="mb-6">
          <Text variant="h1">Analytics</Text>
          <Text variant="muted">Visualize your training effort</Text>
        </View>

        <View className="gap-6">
          <StatsOverview stats={workoutStats} />
          
          <Card>
            <CardHeader>
              <CardTitle>Activity Heatmap</CardTitle>
            </CardHeader>
            <CardContent>
              <CalendarHeatMap markedDates={markedDates} />
              <WorkoutLegend />
            </CardContent>
          </Card>

          <MuscleGroupStats 
            stats={workoutStats.muscleGroupStats} 
            uncategorized={workoutStats.uncategorized}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default Analytics;
