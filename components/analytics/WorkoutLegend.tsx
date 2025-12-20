// WorkoutLegend.tsx
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import React from 'react';
import { View } from 'react-native';
import { optimalSetRecommendations } from '../../utils/helpers';

const WorkoutLegend: React.FC = () => {
  return (
    <View className="mt-4 gap-6">
      <View>
        <Text variant="h4" className="mb-3">Optimal Set Recommendations</Text>
        <Text variant="muted" className="mb-4 text-xs">Guidelines per muscle group per session</Text>
        <View className="gap-2">
          {Object.keys(optimalSetRecommendations).map((group) => {
            const rec = optimalSetRecommendations[group];
            return (
              <View key={group} className="flex-row items-center justify-between">
                <Text className="font-medium capitalize text-sm">{group}</Text>
                <Text variant="muted" className="text-xs">
                  Min {rec.min} • Optimal {rec.optimal} • Max {rec.upper}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      <Separator />
      
      <View>
        <Text variant="h4" className="mb-3">Activity Intensity</Text>
        <Text variant="muted" className="mb-4 text-xs">Based on total sets per day</Text>
        <View className="flex-row flex-wrap gap-4">
          {[
            {color: '#eee', text: '1-9: Very Light'},
            {color: '#FFCCBC', text: '10-14: Light'},
            {color: '#FF8A65', text: '15-19: Medium'},
            {color: '#FF5722', text: '20+: Heavy'}
          ].map(({color, text}, index) => (
            <View key={index} className="flex-row items-center gap-2">
              <View 
                className="w-3 h-3 rounded-[2px]" 
                style={{ backgroundColor: color }} 
              />
              <Text className="text-xs text-muted-foreground">{text}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
};

export default WorkoutLegend;
