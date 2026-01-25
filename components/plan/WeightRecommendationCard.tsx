import React from 'react';
import { View } from 'react-native';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Text } from '@/components/ui/text';

type WeightRecommendationCardProps = {
  exercise: string;
  prescription: string;
  weight?: string;
  confidence?: 'high' | 'medium' | 'low';
  notes?: string;
};

export function WeightRecommendationCard({
  exercise,
  prescription,
  weight,
  confidence,
  notes,
}: WeightRecommendationCardProps) {
  return (
    <Card className="mb-3">
      <CardHeader className="flex-row items-center justify-between py-3">
        <CardTitle>{exercise}</CardTitle>
        {confidence && (
          <Badge
            variant={confidence === 'high' ? 'secondary' : confidence === 'medium' ? 'outline' : 'destructive'}
            label={confidence}
          />
        )}
      </CardHeader>
      <CardContent className="gap-1">
        <Text variant="small">{prescription}</Text>
        {weight && <Text className="font-semibold">{weight}</Text>}
        {notes && (
          <View className="mt-1">
            <Text variant="small" className="text-muted-foreground italic">
              {notes}
            </Text>
          </View>
        )}
      </CardContent>
    </Card>
  );
}
