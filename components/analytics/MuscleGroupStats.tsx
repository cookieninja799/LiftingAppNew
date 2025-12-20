// MuscleGroupStats.tsx
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import React, { useState } from 'react';
import { View } from 'react-native';
import { UncategorizedStats, WeeklySetsBreakdown } from '../../utils/analytics/calculateStats';
import { getCurrentWeek, getVolumeStatus } from '../../utils/helpers';

export type SetCountMode = 'direct' | 'fractional' | 'touched';

interface MuscleGroupStatsProps {
    stats: Record<string, { 
      totalVolume: number;
      totalVolumeDirect: number;
      totalVolumeAllocated: number;
      averageVolume: number;
      averageVolumeDirect: number;
      averageVolumeAllocated: number;
      weeklySets: WeeklySetsBreakdown;
    }>;
    uncategorized?: UncategorizedStats;
}

const MODE_OPTIONS = [
  { label: 'Direct', value: 'direct' },
  { label: 'Fractional', value: 'fractional' },
  { label: 'Touched', value: 'touched' },
];

/**
 * Formats set count for display based on mode.
 * - direct/touched: integer display
 * - fractional: display with 1 decimal (rounded to nearest 0.5)
 */
function formatSetCount(count: number, mode: SetCountMode): string {
  if (mode === 'fractional') {
    // Round to nearest 0.5 for nicer UX
    const rounded = Math.round(count * 2) / 2;
    // Display with 1 decimal if not a whole number
    return rounded % 1 === 0 ? rounded.toString() : rounded.toFixed(1);
  }
  return Math.round(count).toString();
}
  
const MuscleGroupStats: React.FC<MuscleGroupStatsProps> = ({ stats, uncategorized }) => {
    const currentWeek = getCurrentWeek();
    const [mode, setMode] = useState<SetCountMode>('fractional');

    // Find the most recent week that has any data if current week is empty
    const allWeeks = new Set<string>();
    Object.values(stats).forEach(s => {
      Object.keys(s.weeklySets.touched).forEach(w => allWeeks.add(w));
    });
    const sortedWeeks = Array.from(allWeeks).sort().reverse();
    const latestWeekWithData = sortedWeeks[0] || currentWeek;
    
    // Use latest week if current week has no data for any muscle group
    const hasDataForCurrentWeek = Object.values(stats).some(s => s.weeklySets.touched[currentWeek] > 0);
    const displayWeek = hasDataForCurrentWeek ? currentWeek : latestWeekWithData;

    // Get uncategorized sets for display week
    const uncategorizedSets = uncategorized?.weeklySets?.[displayWeek] || 0;
  
    return (
      <Card>
        <CardHeader>
          <View className="flex-row items-center justify-between">
            <View>
              <CardTitle>Muscle Group Analysis</CardTitle>
              <Text variant="muted">
                {displayWeek === currentWeek ? "Weekly sets & average volume" : `Stats for week ${displayWeek}`}
              </Text>
            </View>
          </View>
        </CardHeader>
        <CardContent className="gap-4">
          {/* Mode Toggle */}
          <SegmentedControl
            options={MODE_OPTIONS}
            value={mode}
            onChange={(value) => setMode(value as SetCountMode)}
          />

          {/* Uncategorized Sets Notice */}
          {uncategorizedSets > 0 && (
            <View className="bg-muted/50 rounded-md p-3 mb-2">
              <Text variant="small" className="text-muted-foreground">
                Uncategorized sets ({displayWeek}): {uncategorizedSets}
              </Text>
            </View>
          )}

          {Object.keys(stats).length === 0 ? (
            <Text variant="muted" className="text-center py-4">No data available.</Text>
          ) : (
            Object.keys(stats).map((group, idx) => {
              // Get sets based on current mode and display week
              const weeklySetsByMode = stats[group]?.weeklySets?.[mode]?.[displayWeek] || 0;
              const displaySets = formatSetCount(weeklySetsByMode, mode);
              const statusMessage = getVolumeStatus(group, weeklySetsByMode, mode);
              
              const averageVolume = stats[group].averageVolume && !isNaN(stats[group].averageVolume)
                ? stats[group].averageVolume.toFixed(0)
                : "0";

              return (
                <View key={group}>
                  {idx > 0 && <Separator className="mb-4" />}
                  <View className="flex-row items-center justify-between mb-2">
                    <Text className="font-bold text-lg capitalize">{group}</Text>
                    <Badge 
                      variant={weeklySetsByMode > 0 ? "default" : "secondary"} 
                      label={`${displaySets} sets`} 
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
