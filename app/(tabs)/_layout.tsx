import { useEffectiveColorScheme } from '@/components/theme';
import { Colors } from '@/constants/Colors';
import { debugLog } from '@/lib/debugLogger';
import { Ionicons } from '@expo/vector-icons';
import { NavigationContext } from '@react-navigation/native';
import { Tabs } from 'expo-router';
import { useContext } from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabsLayout() {
  const colorScheme = useEffectiveColorScheme();
  const insets = useSafeAreaInsets();
  const navigationContext = useContext(NavigationContext);

  // Add extra padding for iOS home indicator
  const bottomPadding = Platform.OS === 'ios' ? Math.max(insets.bottom, 10) : 10;

  // #region agent log
  debugLog({
    location: 'app/(tabs)/_layout.tsx:12',
    message: 'TabsLayout render',
    data: {
      colorScheme,
      hasNavigationContext: !!navigationContext,
      tabRoutes: navigationContext?.route?.state?.routeNames ?? [],
    },
    sessionId: 'debug-session',
    runId: 'post-fix',
    hypothesisId: 'H4',
  });
  // #endregion

  console.log(
    `[H4] TabsLayout render colorScheme=${colorScheme} hasNav=${!!navigationContext} tabRoutes=${JSON.stringify(
      navigationContext?.route?.state?.routeNames ?? []
    )}`
  );

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap;

          if (route.name === 'RecordWorkout') iconName = 'add-circle-outline';
          else if (route.name === 'Logs') iconName = 'list-outline';
          else if (route.name === 'Analytics') iconName = 'bar-chart-outline';
          else if (route.name === 'PRTab') iconName = 'trophy-outline';
          else if (route.name === 'Profile') iconName = 'person-outline';
          else iconName = 'help-circle-outline';

          return <Ionicons name={iconName} size={24} color={color} />;
        },
        tabBarActiveTintColor: Colors[colorScheme].tint,
        tabBarInactiveTintColor: Colors[colorScheme].tabIconDefault,
        tabBarStyle: {
          borderTopWidth: 1,
          borderTopColor: Colors[colorScheme].border,
          backgroundColor: Colors[colorScheme].background,
          height: 50 + bottomPadding,
          paddingBottom: bottomPadding,
          paddingTop: 5,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
        },
      })}
    >
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen name="RecordWorkout" options={{ title: 'Record' }} />
      <Tabs.Screen name="Logs" options={{ title: 'Logs' }} />
      <Tabs.Screen name="Analytics" options={{ title: 'Analytics' }} />
      <Tabs.Screen name="PRTab" options={{ title: 'PR' }} />
      <Tabs.Screen name="Profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
