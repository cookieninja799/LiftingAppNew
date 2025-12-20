// PRSummaryCards.tsx
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import React from 'react';
import { View } from 'react-native';

export interface PRMetric {
  exercise: string;
  maxWeight: number;
  reps: number;
  date: string;
}

interface PRSummaryCardsProps {
  prMetrics: PRMetric[];
  period: string;
}

const PRSummaryCards: React.FC<PRSummaryCardsProps> = ({ prMetrics, period }) => {
  if (prMetrics.length === 0) {
    return (
      <Card className="bg-muted/50 border-dashed py-12">
        <CardContent className="items-center justify-center">
          <Text variant="muted">No PRs found matching your search.</Text>
        </CardContent>
      </Card>
    );
  }

  return (
    <View className="flex-row flex-wrap gap-4">
      {prMetrics.map((metric) => (
        <Card key={metric.exercise} className="w-[47%] min-w-[150px]">
          <CardHeader className="p-4 pb-2">
            <Text className="font-bold capitalize" numberOfLines={1}>{metric.exercise}</Text>
          </CardHeader>
          <CardContent className="p-4 pt-0 gap-2">
            <View>
              <Text variant="h3" className="text-primary">{metric.maxWeight} lbs</Text>
              <Text variant="muted" className="text-[10px] uppercase">at {metric.reps} reps</Text>
            </View>
            <Separator />
            <Text variant="muted" className="text-[10px]">
              Achieved: {new Date(metric.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
            </Text>
          </CardContent>
        </Card>
      ))}
    </View>
  );
};

export default PRSummaryCards;
