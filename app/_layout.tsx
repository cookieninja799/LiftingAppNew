import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';
import '../global.css';

import { ThemeProvider } from '@/components/theme';
import { AuthProvider, useAuth } from '../providers/AuthProvider';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <AuthProvider>
      <ThemeProvider>
        <RootLayoutNav />
      </ThemeProvider>
    </AuthProvider>
  );
}

function RootLayoutNav() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    // Check if we're in the auth group
    const inAuthGroup = segments[0] === '(auth)';

    if (!session && !inAuthGroup) {
      // User is not signed in and not on an auth screen, redirect to sign-in
      router.replace('/(auth)/sign-in');
    } else if (session && inAuthGroup) {
      // User is signed in but on an auth screen, redirect to main app
      // Exception: allow reset-password to complete even with a session
      // (the session is set during the reset flow before password is updated)
      const currentRoute = segments[1];
      if (currentRoute !== 'reset-password') {
        router.replace('/(tabs)');
      }
    }
  }, [session, loading, segments]);

  if (loading) {
    return null;
  }

  return (
    <Stack>
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
      <Stack.Screen name="review-parsed-workout" options={{ presentation: 'modal', title: 'Review Workout' }} />
    </Stack>
  );
}
