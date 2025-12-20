// MuscleGroupStats.tsx
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import React from 'react';
import { View } from 'react-native';
import { getCurrentWeek, getVolumeStatus } from '../../utils/helpers';

interface MuscleGroupStatsProps {
    stats: Record<string, { 
      totalVolume: number;
      averageVolume: number;
      weeklySets: Record<string, number>;
    }>;
}
  
const MuscleGroupStats: React.FC<MuscleGroupStatsProps> = ({ stats }) => {
    const currentWeek = getCurrentWeek();
  
    return (
      <Card>
        <CardHeader>
          <CardTitle>Muscle Group Analysis</CardTitle>
          <Text variant="muted">Weekly sets & average volume per session</Text>
        </CardHeader>
        <CardContent className="gap-4">
          {Object.keys(stats).length === 0 ? (
            <Text variant="muted" className="text-center py-4">No data available for this week.</Text>
          ) : (
            Object.keys(stats).map((group, idx) => {
              const weeklyTotalSets = stats[group]?.weeklySets?.[currentWeek] || 0;
              const statusMessage = getVolumeStatus(group, weeklyTotalSets);
              
              const averageVolume = stats[group].averageVolume && !isNaN(stats[group].averageVolume)
                ? stats[group].averageVolume.toFixed(0)
                : "0";

              return (
                <View key={group}>
                  {idx > 0 && <Separator className="mb-4" />}
                  <View className="flex-row items-center justify-between mb-2">
                    <Text className="font-bold text-lg capitalize">{group}</Text>
                    <Badge 
                      variant={weeklyTotalSets > 0 ? "default" : "secondary"} 
                      label={`${weeklyTotalSets} sets`} 
                    />
                  </View>
                  
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1">
                      <Text variant="small" className="text-muted-foreground mb-1">Status</Text>
                      <Text className="text-sm">{statusMessage}</Text>
                    </View>
                    <View className="items-end">
                      <Text variant="small" className="text-muted-foreground mb-1">Avg Volume</Text>
                      <Text className="text-sm font-medium">{averageVolume} lbs</Text>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </CardContent>
      </Card>
    );
};

export default MuscleGroupStats;
