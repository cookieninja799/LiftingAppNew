import { Link, Stack } from 'expo-router';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';

export default function NotFoundScreen() {
  return (
    <SafeAreaView className="flex-1 bg-background">
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View className="flex-1 items-center justify-center p-6">
        <Text variant="h2">Not Found</Text>
        <Text variant="muted" className="mt-2 mb-8 text-center">
          This screen doesn't exist.
        </Text>

        <Link href="/">
          <Text className="text-primary font-medium">Go to home screen!</Text>
        </Link>
      </View>
    </SafeAreaView>
  );
}
