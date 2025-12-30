import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Platform,
  Pressable,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { useEffectiveColorScheme } from '@/components/theme';
import { supabase } from '@/lib/supabase';

/**
 * Maps Supabase auth errors to user-friendly messages
 */
export function getAuthErrorMessage(error: any): string {
  const message = error?.message?.toLowerCase() || '';
  const code = error?.code || '';

  // Invalid credentials
  if (message.includes('invalid login credentials') || code === 'invalid_credentials') {
    return 'Invalid email or password. Please check your credentials and try again.';
  }

  // Email not confirmed
  if (message.includes('email not confirmed') || code === 'email_not_confirmed') {
    return 'Please verify your email address before signing in. Check your inbox for the confirmation link.';
  }

  // User not found
  if (message.includes('user not found') || code === 'user_not_found') {
    return 'No account found with this email. Would you like to sign up instead?';
  }

  // Too many requests / rate limited
  if (message.includes('too many requests') || message.includes('rate limit') || code === 'over_request_rate_limit') {
    return 'Too many sign-in attempts. Please wait a moment and try again.';
  }

  // Network errors
  if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
    return 'Unable to connect. Please check your internet connection and try again.';
  }

  // Weak password (for sign up)
  if (message.includes('password') && (message.includes('weak') || message.includes('short') || message.includes('at least'))) {
    return 'Password is too weak. Please use at least 6 characters.';
  }

  // Email already registered
  if (message.includes('already registered') || message.includes('already exists')) {
    return 'An account with this email already exists. Try signing in instead.';
  }

  // Invalid email format
  if (message.includes('invalid email') || message.includes('valid email')) {
    return 'Please enter a valid email address.';
  }

  // Default fallback
  return error?.message || 'An unexpected error occurred. Please try again.';
}

export default function SignInScreen() {
  const colorScheme = useEffectiveColorScheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  const handleAuth = async () => {
    if (!email || !password) {
      Alert.alert('Missing Information', 'Please enter both email and password.');
      return;
    }

    setLoading(true);
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        Alert.alert(
          'Check Your Email',
          'We sent you a confirmation link. Please check your email to verify your account.',
          [{ text: 'OK' }]
        );
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        // Navigation happens automatically via auth state change
      }
    } catch (error: any) {
      Alert.alert(
        isSignUp ? 'Sign Up Failed' : 'Sign In Failed',
        getAuthErrorMessage(error)
      );
    } finally {
      setLoading(false);
    }
  };

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
            <Text variant="h1" className="text-center">
              {isSignUp ? 'Create Account' : 'Welcome Back'}
            </Text>
            <Text variant="muted" className="text-center mt-2">
              {isSignUp ? 'Sign up to start tracking your workouts' : 'Sign in to continue your fitness journey'}
            </Text>
          </View>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle>{isSignUp ? 'Sign Up' : 'Sign In'}</CardTitle>
              <CardDescription>
                {isSignUp ? 'Create a new account' : 'Enter your credentials to continue'}
              </CardDescription>
            </CardHeader>
            <CardContent className="gap-4">
              <View>
                <Text variant="small" className="mb-2 text-muted-foreground">Email</Text>
                <Input
                  placeholder="you@example.com"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                  textContentType="emailAddress"
                  testID="email-input"
                />
              </View>
              <View>
                <Text variant="small" className="mb-2 text-muted-foreground">Password</Text>
                <Input
                  placeholder="••••••••"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoComplete={isSignUp ? 'new-password' : 'current-password'}
                  textContentType={isSignUp ? 'newPassword' : 'password'}
                  testID="password-input"
                />
              </View>

              <Button
                label={loading ? '' : (isSignUp ? 'Sign Up' : 'Sign In')}
                onPress={handleAuth}
                disabled={loading}
                className="w-full mt-2"
                testID="auth-button"
              >
                {loading && <ActivityIndicator color="#fff" />}
              </Button>

              {!isSignUp && (
                <Link href="/(auth)/forgot-password" asChild>
                  <Pressable className="items-center py-2">
                    <Text className="text-primary">Forgot Password?</Text>
                  </Pressable>
                </Link>
              )}
            </CardContent>
          </Card>

          <Pressable onPress={() => setIsSignUp(!isSignUp)} className="items-center py-4">
            <Text className="text-primary">
              {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
            </Text>
          </Pressable>
        </View>
        <StatusBar style={Platform.OS === 'ios' ? (colorScheme === 'dark' ? 'light' : 'dark') : 'auto'} />
      </SafeAreaView>
    </TouchableWithoutFeedback>
  );
}
