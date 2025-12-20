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
import { computeVolumeForExercise, getCurrentWeek, getWeekFromDate, loadUserProfile } from '../../utils/helpers';
import { WorkoutSession } from '../../utils/workoutSessions';

interface WorkoutStats {
  totalWorkoutDays: number;
  mostCommonExercise: string;
  averageExercisesPerDay: number;
  averageSetsPerDay: number;
  muscleGroupStats: Record<string, { totalVolume: number; averageVolume: number; weeklySets: Record<string, number>; }>;
}

const Analytics: React.FC = () => {
  const [workoutStats, setWorkoutStats] = useState<WorkoutStats>({
    totalWorkoutDays: 0,
    mostCommonExercise: '',
    averageExercisesPerDay: 0,
    averageSetsPerDay: 0,
    muscleGroupStats: {},
  });
  const [markedDates, setMarkedDates] = useState<Record<string, any>>({});

  const calculateStats = async () => {
    await loadUserProfile();
    try {
      const storedSessions = await AsyncStorage.getItem('workoutSessions');
      if (!storedSessions) return;
  
      const sessions: WorkoutSession[] = JSON.parse(storedSessions);
      const dateTotalSets: Record<string, number> = {};
      const totalWorkoutDays = sessions.length;
      let totalExercises = 0;
      let totalSets = 0;
      const exerciseFrequency: Record<string, number> = {};
      
      const currentWeek = getCurrentWeek();
  
      const weeklyMuscleGroupStats: Record<string, Record<string, { totalSets: number; totalVolume: number; sessionCount: number; weeklySets: Record<string, number> }>> = {};
  
      sessions.forEach(session => {
        let dailyTotalSets = 0;
        session.exercises.forEach(ex => {
          dailyTotalSets += ex.sets;
        });
  
        dateTotalSets[session.date] = dailyTotalSets;
        const week = getWeekFromDate(session.date);
        if (!weeklyMuscleGroupStats[week]) {
          weeklyMuscleGroupStats[week] = {};
        }
  
        session.exercises.forEach(ex => {
          totalSets += ex.sets;
          totalExercises++;
  
          const key = ex.exercise.toLowerCase();
          exerciseFrequency[key] = (exerciseFrequency[key] || 0) + 1;
  
          if (!weeklyMuscleGroupStats[week][ex.primaryMuscleGroup]) {
            weeklyMuscleGroupStats[week][ex.primaryMuscleGroup] = {
              totalSets: 0,
              totalVolume: 0,
              sessionCount: 0,
              weeklySets: {},
            };
          }
  
          const exerciseVolume = computeVolumeForExercise(ex);
  
          weeklyMuscleGroupStats[week][ex.primaryMuscleGroup].totalSets += ex.sets;
          weeklyMuscleGroupStats[week][ex.primaryMuscleGroup].totalVolume += exerciseVolume;
          weeklyMuscleGroupStats[week][ex.primaryMuscleGroup].sessionCount += 1;
          weeklyMuscleGroupStats[week][ex.primaryMuscleGroup].weeklySets[week] =
            (weeklyMuscleGroupStats[week][ex.primaryMuscleGroup].weeklySets[week] || 0) + ex.sets;
        });
      });

      setMarkedDates(dateTotalSets);
      
      const muscleGroupStats: Record<string, { totalVolume: number; averageVolume: number; weeklySets: Record<string, number> }> = {};
      const weeklySessionCounts: Record<string, Record<string, number>> = {};

      Object.keys(weeklyMuscleGroupStats).forEach(week => {
        Object.keys(weeklyMuscleGroupStats[week]).forEach(group => {
          if (!muscleGroupStats[group]) {
            muscleGroupStats[group] = { totalVolume: 0, averageVolume: 0, weeklySets: {} };
          }
          if (!weeklySessionCounts[week]) {
            weeklySessionCounts[week] = {};
          }
          if (!weeklySessionCounts[week][group]) {
            weeklySessionCounts[week][group] = 0;
          }

          const totalVolume = weeklyMuscleGroupStats[week][group].totalVolume;
          const sessionCount = weeklyMuscleGroupStats[week][group].sessionCount;

          muscleGroupStats[group].totalVolume += totalVolume;
          muscleGroupStats[group].weeklySets[week] = weeklyMuscleGroupStats[week][group].weeklySets[week];
          weeklySessionCounts[week][group] += sessionCount;
        });
      });

      Object.keys(weeklySessionCounts).forEach(week => {
        if (week === currentWeek) {
          Object.keys(weeklySessionCounts[week]).forEach(group => {
            if (muscleGroupStats[group].weeklySets[week]) {
              const totalVolume = weeklyMuscleGroupStats[week][group].totalVolume;
              const numSessions = weeklySessionCounts[week][group];

              muscleGroupStats[group].averageVolume = numSessions > 0 
                ? totalVolume / numSessions 
                : 0;
            }
          });
        }
      });
  
      let mostCommonExercise = Object.keys(exerciseFrequency).length > 0
        ? Object.keys(exerciseFrequency).reduce((a, b) =>
          exerciseFrequency[a] > exerciseFrequency[b] ? a : b)
        : 'N/A';
  
      setWorkoutStats({
        totalWorkoutDays,
        mostCommonExercise,
        averageExercisesPerDay: totalWorkoutDays ? totalExercises / totalWorkoutDays : 0,
        averageSetsPerDay: totalWorkoutDays ? totalSets / totalWorkoutDays : 0,
        muscleGroupStats,
      });
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

          <MuscleGroupStats stats={workoutStats.muscleGroupStats} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default Analytics;
