import { useEffectiveColorScheme } from '@/components/theme';
import { StatusBar } from 'expo-status-bar';
import { Platform, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';

export default function ModalScreen() {
  const colorScheme = useEffectiveColorScheme();

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 items-center justify-center p-6">
        <Text variant="h2">Information</Text>
        <Separator className="my-8 w-[80%]" />
        
        <Text className="text-center text-muted-foreground">
          This is a system modal. You can use it to display additional information or settings.
        </Text>

        {/* StatusBar adapts to theme on iOS */}
        <StatusBar style={Platform.OS === 'ios' ? (colorScheme === 'dark' ? 'light' : 'dark') : 'auto'} />
      </View>
    </SafeAreaView>
  );
}
