import React, { useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Platform,
  Pressable,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Linking from 'expo-linking';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { useEffectiveColorScheme } from '@/components/theme';
import { supabase } from '@/lib/supabase';

export default function ResetPasswordScreen() {
  const colorScheme = useEffectiveColorScheme();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [sessionSet, setSessionSet] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get params from URL (Expo Router will parse query params)
  const params = useLocalSearchParams();

  useEffect(() => {
    handleDeepLink();
  }, []);

  const handleDeepLink = async () => {
    try {
      // Get the initial URL that opened the app
      const url = await Linking.getInitialURL();

      // Try to extract tokens from multiple sources:
      // 1. Query params passed by Expo Router
      // 2. Fragment params from the URL (Supabase often uses #access_token=...)
      // 3. Direct URL parsing

      let accessToken = params.access_token as string | undefined;
      let refreshToken = params.refresh_token as string | undefined;
      let type = params.type as string | undefined;

      // If not in query params, try to parse from URL fragment
      if (!accessToken && url) {
        const parsedUrl = Linking.parse(url);

        // Check query params from parsed URL
        if (parsedUrl.queryParams) {
          accessToken = accessToken || (parsedUrl.queryParams.access_token as string);
          refreshToken = refreshToken || (parsedUrl.queryParams.refresh_token as string);
          type = type || (parsedUrl.queryParams.type as string);
        }

        // Also check for fragment params (after #)
        // Supabase sometimes sends tokens in the fragment
        if (url.includes('#')) {
          const fragment = url.split('#')[1];
          if (fragment) {
            const fragmentParams = new URLSearchParams(fragment);
            accessToken = accessToken || fragmentParams.get('access_token') || undefined;
            refreshToken = refreshToken || fragmentParams.get('refresh_token') || undefined;
            type = type || fragmentParams.get('type') || undefined;
          }
        }
      }

      // Verify this is a recovery flow
      if (type !== 'recovery') {
        // Check if we already have a session (user might have clicked link twice)
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session) {
          setSessionSet(true);
          setInitializing(false);
          return;
        }

        setError('Invalid or expired reset link. Please request a new password reset.');
        setInitializing(false);
        return;
      }

      if (!accessToken || !refreshToken) {
        setError('Invalid reset link. Please request a new password reset.');
        setInitializing(false);
        return;
      }

      // Set the session with the recovery tokens
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (sessionError) {
        console.error('Session error:', sessionError);
        setError('This reset link has expired. Please request a new password reset.');
        setInitializing(false);
        return;
      }

      setSessionSet(true);
      setInitializing(false);
    } catch (err) {
      console.error('Deep link handling error:', err);
      setError('Something went wrong. Please request a new password reset.');
      setInitializing(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!password) {
      Alert.alert('Missing Password', 'Please enter a new password.');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Weak Password', 'Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Password Mismatch', 'Passwords do not match. Please try again.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) throw error;

      Alert.alert('Password Updated', 'Your password has been successfully updated.', [
        {
          text: 'Continue',
          onPress: () => {
            // Navigate to main app - user is now logged in
            router.replace('/(tabs)');
          },
        },
      ]);
    } catch (error: any) {
      console.error('Update password error:', error);

      let message = 'Failed to update password. Please try again.';
      if (error.message?.includes('same as')) {
        message = 'New password must be different from your current password.';
      } else if (error.message?.includes('weak') || error.message?.includes('short')) {
        message = 'Password is too weak. Please use a stronger password.';
      }

      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  // Loading state while processing deep link
  if (initializing) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" className="mb-4" />
          <Text variant="muted">Verifying reset link...</Text>
        </View>
        <StatusBar style={Platform.OS === 'ios' ? (colorScheme === 'dark' ? 'light' : 'dark') : 'auto'} />
      </SafeAreaView>
    );
  }

  // Error state
  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 justify-center px-6">
          <Card>
            <CardContent className="items-center py-10">
              <Text className="text-6xl mb-6">⚠️</Text>
              <Text variant="h2" className="text-center mb-3">Reset Link Invalid</Text>
              <Text variant="muted" className="text-center">
                {error}
              </Text>
            </CardContent>
          </Card>

          <View className="mt-6 gap-4">
            <Button
              label="Request New Reset Link"
              onPress={() => router.replace('/(auth)/forgot-password')}
              className="w-full"
            />

            <Pressable
              onPress={() => router.replace('/(auth)/sign-in')}
              className="items-center py-3"
            >
              <Text className="text-primary">← Back to Sign In</Text>
            </Pressable>
          </View>
        </View>
        <StatusBar style={Platform.OS === 'ios' ? (colorScheme === 'dark' ? 'light' : 'dark') : 'auto'} />
      </SafeAreaView>
    );
  }

  // Session set, show password update form
  return (
    <TouchableWithoutFeedback
      onPress={(e) => {
        if (Platform.OS === 'web') {
          const target = e?.nativeEvent?.target as any;
          const targetTag = target?.tagName;
          if (targetTag === 'INPUT' || targetTag === 'TEXTAREA' || targetTag === 'BUTTON') {
            return;
          }
        }
        Keyboard.dismiss();
      }}
    >
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 justify-center px-6">
          <View className="mb-8">
            <Text variant="h1" className="text-center">Set New Password</Text>
            <Text variant="muted" className="text-center mt-2">
              Enter your new password below. Make sure it's at least 6 characters.
            </Text>
          </View>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle>New Password</CardTitle>
              <CardDescription>
                Choose a strong password for your account
              </CardDescription>
            </CardHeader>
            <CardContent className="gap-4">
              <View>
                <Text variant="small" className="mb-2 text-muted-foreground">New Password</Text>
                <Input
                  placeholder="••••••••"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoComplete="new-password"
                  textContentType="newPassword"
                  autoFocus
                  testID="password-input"
                />
              </View>
              <View>
                <Text variant="small" className="mb-2 text-muted-foreground">Confirm Password</Text>
                <Input
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  autoComplete="new-password"
                  textContentType="newPassword"
                  testID="confirm-password-input"
                />
              </View>

              <Button
                label={loading ? '' : 'Update Password'}
                onPress={handleUpdatePassword}
                disabled={loading}
                className="w-full mt-2"
                testID="update-password-button"
              >
                {loading && <ActivityIndicator color="#fff" />}
              </Button>
            </CardContent>
          </Card>
        </View>
        <StatusBar style={Platform.OS === 'ios' ? (colorScheme === 'dark' ? 'light' : 'dark') : 'auto'} />
      </SafeAreaView>
    </TouchableWithoutFeedback>
  );
}
