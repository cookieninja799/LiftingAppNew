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
import * as Linking from 'expo-linking';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { useEffectiveColorScheme } from '@/components/theme';
import { supabase } from '@/lib/supabase';

export default function ForgotPasswordScreen() {
  const colorScheme = useEffectiveColorScheme();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleResetPassword = async () => {
    if (!email) {
      Alert.alert('Missing Email', 'Please enter your email address.');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      // Generate the redirect URL for the reset-password screen
      const redirectTo = Linking.createURL('/reset-password');

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });

      if (error) throw error;

      setEmailSent(true);
    } catch (error: any) {
      // Don't reveal if email exists or not for security
      // Still show success message to prevent email enumeration
      console.error('Password reset error:', error);
      setEmailSent(true);
    } finally {
      setLoading(false);
    }
  };

  if (emailSent) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 justify-center px-6">
          <Card>
            <CardContent className="items-center py-10">
              <Text className="text-6xl mb-6">✉️</Text>
              <Text variant="h2" className="text-center mb-3">Check Your Email</Text>
              <Text variant="muted" className="text-center mb-2">
                If an account exists for {email}, you'll receive a password reset link shortly.
              </Text>
              <Text variant="small" className="text-center text-muted-foreground">
                Be sure to check your spam folder if you don't see it in your inbox.
              </Text>
            </CardContent>
          </Card>

          <View className="mt-6 gap-4">
            <Button
              label="Try Another Email"
              variant="outline"
              onPress={() => {
                setEmailSent(false);
                setEmail('');
              }}
              className="w-full"
            />

            <Link href="/(auth)/sign-in" asChild>
              <Pressable className="items-center py-3">
                <Text className="text-primary">← Back to Sign In</Text>
              </Pressable>
            </Link>
          </View>
        </View>
        <StatusBar style={Platform.OS === 'ios' ? (colorScheme === 'dark' ? 'light' : 'dark') : 'auto'} />
      </SafeAreaView>
    );
  }

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
            <Text variant="h1" className="text-center">Reset Password</Text>
            <Text variant="muted" className="text-center mt-2">
              Enter your email address and we'll send you a link to reset your password.
            </Text>
          </View>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Forgot Password</CardTitle>
              <CardDescription>
                We'll email you a secure link to reset your password
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
                  autoFocus
                  testID="email-input"
                />
              </View>

              <Button
                label={loading ? '' : 'Send Reset Link'}
                onPress={handleResetPassword}
                disabled={loading}
                className="w-full mt-2"
                testID="reset-button"
              >
                {loading && <ActivityIndicator color="#fff" />}
              </Button>
            </CardContent>
          </Card>

          <Link href="/(auth)/sign-in" asChild>
            <Pressable className="items-center py-4">
              <Text className="text-primary">← Back to Sign In</Text>
            </Pressable>
          </Link>
        </View>
        <StatusBar style={Platform.OS === 'ios' ? (colorScheme === 'dark' ? 'light' : 'dark') : 'auto'} />
      </SafeAreaView>
    </TouchableWithoutFeedback>
  );
}
