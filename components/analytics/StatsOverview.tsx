// StatsOverview.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import React from 'react';
import { View } from 'react-native';

interface StatsOverviewProps {
  stats: {
    totalWorkoutDays: number;
    mostCommonExercise: string;
    averageExercisesPerDay: number;
    averageSetsPerDay: number;
  };
}

const StatsOverview: React.FC<StatsOverviewProps> = ({ stats }) => {
  const statItems = [
    { label: 'Total Days', value: stats.totalWorkoutDays },
    { label: 'Common Ex', value: stats.mostCommonExercise || 'N/A', capitalize: true },
    { label: 'Avg Ex/Day', value: stats.averageExercisesPerDay.toFixed(1) },
    { label: 'Avg Sets/Day', value: stats.averageSetsPerDay.toFixed(1) },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Overview</CardTitle>
      </CardHeader>
      <CardContent className="flex-row flex-wrap gap-4">
        {statItems.map((item, idx) => (
          <View key={idx} className="flex-1 min-w-[120px] bg-muted/50 p-3 rounded-lg">
            <Text variant="muted" className="text-xs mb-1 uppercase tracking-wider">{item.label}</Text>
            <Text variant="large" className={item.capitalize ? "capitalize" : ""}>{item.value}</Text>
          </View>
        ))}
      </CardContent>
    </Card>
  );
};

export default StatsOverview;
