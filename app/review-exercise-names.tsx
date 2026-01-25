import React, { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { Badge } from '@/components/ui/badge';
import { workoutRepository } from '@/data/WorkoutRepositoryManager';
import {
  loadNormalizationReviewItems,
  saveNormalizationReviewItems,
  NormalizationReviewItem,
} from '@/utils/data/exerciseNormalizationReview';

type GroupedReview = {
  key: string;
  suggestedCanonical: string;
  items: NormalizationReviewItem[];
};

export default function ReviewExerciseNames() {
  const [items, setItems] = useState<NormalizationReviewItem[]>([]);
  const [editedCanonical, setEditedCanonical] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const loadItems = async () => {
      const pending = await loadNormalizationReviewItems();
      setItems(pending);
    };
    loadItems();
  }, []);

  const groups = useMemo<GroupedReview[]>(() => {
    const grouped = new Map<string, NormalizationReviewItem[]>();
    items.forEach((item) => {
      const key = item.suggestedCanonical.toLowerCase();
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(item);
    });
    return Array.from(grouped.entries()).map(([key, groupedItems]) => ({
      key,
      suggestedCanonical: groupedItems[0]?.suggestedCanonical || '',
      items: groupedItems,
    }));
  }, [items]);

  const applyGroup = async (
    group: GroupedReview,
    action: 'approve' | 'reject',
    currentItems: NormalizationReviewItem[]
  ): Promise<NormalizationReviewItem[]> => {
    try {
      const canonical = (editedCanonical[group.key] || group.suggestedCanonical).trim();
      const sessions = await workoutRepository.listSessions();
      let updatedCount = 0;

      for (const session of sessions) {
        let sessionUpdated = false;
        for (const exercise of session.exercises) {
          const match = group.items.find(
            (item) => item.sessionId === session.id && item.exerciseId === exercise.id
          );
          if (match) {
            exercise.nameCanonical = action === 'approve' ? (canonical || exercise.nameRaw) : exercise.nameRaw;
            sessionUpdated = true;
          }
        }
        if (sessionUpdated) {
          updatedCount += 1;
          await workoutRepository.upsertSession(session);
        }
      }

      const remaining = currentItems.filter((item) => !group.items.some((g) => g.id === item.id));
      setItems(remaining);
      await saveNormalizationReviewItems(remaining);

      Alert.alert(action === 'approve' ? 'Saved' : 'Rejected', `Updated ${updatedCount} session(s).`);
      return remaining;
    } catch (error) {
      console.error('Failed to apply normalization:', error);
      Alert.alert('Error', 'Failed to apply normalization updates.');
      return currentItems;
    }
  };

  const handleApproveGroup = async (group: GroupedReview) => {
    setIsSaving(true);
    try {
      await applyGroup(group, 'approve', items);
    } catch (error) {
      console.error('Failed to approve normalization:', error);
      Alert.alert('Error', 'Failed to approve normalization updates.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRejectGroup = async (group: GroupedReview) => {
    setIsSaving(true);
    try {
      await applyGroup(group, 'reject', items);
    } catch (error) {
      console.error('Failed to reject normalization:', error);
      Alert.alert('Error', 'Failed to reject normalization updates.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleApproveAll = async () => {
    setIsSaving(true);
    try {
      let remaining = items;
      for (const group of groups) {
        remaining = await applyGroup(group, 'approve', remaining);
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <View className="mb-6">
          <Text variant="h1">Review Exercise Names</Text>
          <Text variant="muted">
            Approve or edit suggested normalizations
          </Text>
        </View>

        {groups.length === 0 ? (
          <Card className="bg-muted/50 border-dashed py-12">
            <CardContent className="items-center justify-center">
              <Text variant="muted">No pending normalization reviews.</Text>
            </CardContent>
          </Card>
        ) : (
          <>
            <View className="flex-row gap-2 mb-4">
              <Button
                label={isSaving ? 'Saving...' : 'Approve All'}
                onPress={handleApproveAll}
                disabled={isSaving}
                className="flex-1"
              />
            </View>

            {groups.map((group) => (
              <Card key={group.key} className="mb-4">
                <CardHeader className="gap-2">
                  <CardTitle>Suggested: {group.suggestedCanonical}</CardTitle>
                  <Text variant="small" className="text-muted-foreground">
                    {group.items.length} variation(s)
                  </Text>
                </CardHeader>
                <Separator />
                <CardContent className="gap-3 pt-3">
                  <View>
                    <Text variant="small" className="mb-1">Canonical name</Text>
                    <Input
                      value={editedCanonical[group.key] ?? group.suggestedCanonical}
                      onChangeText={(text) =>
                        setEditedCanonical((prev) => ({ ...prev, [group.key]: text }))
                      }
                    />
                  </View>

                  <View className="gap-1">
                    {group.items.map((item) => (
                      <View key={item.id} className="flex-row items-center justify-between">
                        <Text variant="small">{item.nameRaw}</Text>
                        <Badge
                          variant="secondary"
                          label={`${item.source.toUpperCase()} ${item.confidence.toUpperCase()}`}
                        />
                      </View>
                    ))}
                  </View>

                  <View className="flex-row gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      label="Reject"
                      onPress={() => handleRejectGroup(group)}
                      disabled={isSaving}
                      className="flex-1"
                    />
                    <Button
                      size="sm"
                      label="Approve"
                      onPress={() => handleApproveGroup(group)}
                      disabled={isSaving}
                      className="flex-1"
                    />
                  </View>
                </CardContent>
              </Card>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
