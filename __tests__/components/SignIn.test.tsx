// __tests__/components/SignIn.test.tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Alert } from 'react-native';

// Mock the theme context
jest.mock('@/components/theme', () => ({
  useEffectiveColorScheme: () => 'light',
}));

// Mock expo-router
const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
};
jest.mock('expo-router', () => ({
  Link: ({ children, asChild }: any) => children,
  router: mockRouter,
}));

// Mock safe-area-context
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: any) => children,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

// Mock expo-status-bar
jest.mock('expo-status-bar', () => ({
  StatusBar: () => null,
}));

// Create mock supabase auth functions
const mockSignUp = jest.fn();
const mockSignInWithPassword = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signUp: (...args: any[]) => mockSignUp(...args),
      signInWithPassword: (...args: any[]) => mockSignInWithPassword(...args),
    },
  },
}));

// Mock Alert
jest.spyOn(Alert, 'alert');

// Import after mocks are set up
import SignInScreen, { getAuthErrorMessage } from '../../app/(auth)/sign-in';

describe('SignInScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSignUp.mockReset();
    mockSignInWithPassword.mockReset();
  });

  describe('rendering', () => {
    it('should render the sign-in form by default', () => {
      render(<SignInScreen />);

      expect(screen.getByText('Welcome Back')).toBeTruthy();
      // 'Sign In' appears multiple times (title and button), so check for at least one
      expect(screen.getAllByText('Sign In').length).toBeGreaterThan(0);
      expect(screen.getByTestId('email-input')).toBeTruthy();
      expect(screen.getByTestId('password-input')).toBeTruthy();
    });

    it('should render forgot password link', () => {
      render(<SignInScreen />);

      expect(screen.getByText('Forgot Password?')).toBeTruthy();
    });

    it('should render toggle to sign up', () => {
      render(<SignInScreen />);

      expect(screen.getByText("Don't have an account? Sign Up")).toBeTruthy();
    });
  });

  describe('mode toggle', () => {
    it('should switch to sign-up mode when toggle is pressed', () => {
      render(<SignInScreen />);

      const toggleButton = screen.getByText("Don't have an account? Sign Up");
      fireEvent.press(toggleButton);

      expect(screen.getByText('Create Account')).toBeTruthy();
      // 'Sign Up' appears multiple times (title and button), so check for at least one
      expect(screen.getAllByText('Sign Up').length).toBeGreaterThan(0);
    });

    it('should hide forgot password link in sign-up mode', () => {
      render(<SignInScreen />);

      const toggleButton = screen.getByText("Don't have an account? Sign Up");
      fireEvent.press(toggleButton);

      expect(screen.queryByText('Forgot Password?')).toBeNull();
    });

    it('should switch back to sign-in mode', () => {
      render(<SignInScreen />);

      // Switch to sign-up
      fireEvent.press(screen.getByText("Don't have an account? Sign Up"));
      expect(screen.getByText('Create Account')).toBeTruthy();

      // Switch back to sign-in
      fireEvent.press(screen.getByText('Already have an account? Sign In'));
      expect(screen.getByText('Welcome Back')).toBeTruthy();
    });
  });

  describe('validation', () => {
    it('should show alert when email is empty', async () => {
      render(<SignInScreen />);

      const authButton = screen.getByTestId('auth-button');
      fireEvent.press(authButton);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Missing Information',
          'Please enter both email and password.'
        );
      });
    });

    it('should show alert when password is empty', async () => {
      render(<SignInScreen />);

      const emailInput = screen.getByTestId('email-input');
      fireEvent.changeText(emailInput, 'test@example.com');

      const authButton = screen.getByTestId('auth-button');
      fireEvent.press(authButton);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Missing Information',
          'Please enter both email and password.'
        );
      });
    });
  });

  describe('sign in', () => {
    it('should call signInWithPassword with correct credentials', async () => {
      mockSignInWithPassword.mockResolvedValue({ error: null });

      render(<SignInScreen />);

      const emailInput = screen.getByTestId('email-input');
      const passwordInput = screen.getByTestId('password-input');
      const authButton = screen.getByTestId('auth-button');

      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'password123');
      fireEvent.press(authButton);

      await waitFor(() => {
        expect(mockSignInWithPassword).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'password123',
        });
      });
    });

    it('should show error alert on sign-in failure', async () => {
      mockSignInWithPassword.mockResolvedValue({
        error: { message: 'Invalid login credentials' },
      });

      render(<SignInScreen />);

      const emailInput = screen.getByTestId('email-input');
      const passwordInput = screen.getByTestId('password-input');
      const authButton = screen.getByTestId('auth-button');

      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'wrongpassword');
      fireEvent.press(authButton);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Sign In Failed',
          'Invalid email or password. Please check your credentials and try again.'
        );
      });
    });
  });

  describe('sign up', () => {
    it('should call signUp with correct credentials', async () => {
      mockSignUp.mockResolvedValue({ error: null });

      render(<SignInScreen />);

      // Switch to sign-up mode
      fireEvent.press(screen.getByText("Don't have an account? Sign Up"));

      const emailInput = screen.getByTestId('email-input');
      const passwordInput = screen.getByTestId('password-input');
      const authButton = screen.getByTestId('auth-button');

      fireEvent.changeText(emailInput, 'newuser@example.com');
      fireEvent.changeText(passwordInput, 'newpassword123');
      fireEvent.press(authButton);

      await waitFor(() => {
        expect(mockSignUp).toHaveBeenCalledWith({
          email: 'newuser@example.com',
          password: 'newpassword123',
        });
      });
    });

    it('should show success alert after successful sign-up', async () => {
      mockSignUp.mockResolvedValue({ error: null });

      render(<SignInScreen />);

      // Switch to sign-up mode
      fireEvent.press(screen.getByText("Don't have an account? Sign Up"));

      const emailInput = screen.getByTestId('email-input');
      const passwordInput = screen.getByTestId('password-input');
      const authButton = screen.getByTestId('auth-button');

      fireEvent.changeText(emailInput, 'newuser@example.com');
      fireEvent.changeText(passwordInput, 'newpassword123');
      fireEvent.press(authButton);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Check Your Email',
          'We sent you a confirmation link. Please check your email to verify your account.',
          [{ text: 'OK' }]
        );
      });
    });

    it('should show error alert on sign-up failure', async () => {
      mockSignUp.mockResolvedValue({
        error: { message: 'User already registered' },
      });

      render(<SignInScreen />);

      // Switch to sign-up mode
      fireEvent.press(screen.getByText("Don't have an account? Sign Up"));

      const emailInput = screen.getByTestId('email-input');
      const passwordInput = screen.getByTestId('password-input');
      const authButton = screen.getByTestId('auth-button');

      fireEvent.changeText(emailInput, 'existing@example.com');
      fireEvent.changeText(passwordInput, 'password123');
      fireEvent.press(authButton);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Sign Up Failed',
          expect.any(String)
        );
      });
    });
  });
});

describe('getAuthErrorMessage', () => {
  it('should return friendly message for invalid credentials', () => {
    const error = { message: 'Invalid login credentials' };
    expect(getAuthErrorMessage(error)).toBe(
      'Invalid email or password. Please check your credentials and try again.'
    );
  });

  it('should return friendly message for invalid_credentials code', () => {
    const error = { code: 'invalid_credentials', message: 'Auth error' };
    expect(getAuthErrorMessage(error)).toBe(
      'Invalid email or password. Please check your credentials and try again.'
    );
  });

  it('should return friendly message for email not confirmed', () => {
    const error = { message: 'Email not confirmed' };
    expect(getAuthErrorMessage(error)).toBe(
      'Please verify your email address before signing in. Check your inbox for the confirmation link.'
    );
  });

  it('should return friendly message for user not found', () => {
    const error = { message: 'User not found' };
    expect(getAuthErrorMessage(error)).toBe(
      'No account found with this email. Would you like to sign up instead?'
    );
  });

  it('should return friendly message for rate limiting', () => {
    const error = { message: 'Too many requests' };
    expect(getAuthErrorMessage(error)).toBe(
      'Too many sign-in attempts. Please wait a moment and try again.'
    );
  });

  it('should return friendly message for network errors', () => {
    const error = { message: 'Network request failed' };
    expect(getAuthErrorMessage(error)).toBe(
      'Unable to connect. Please check your internet connection and try again.'
    );
  });

  it('should return friendly message for weak password', () => {
    const error = { message: 'Password should be at least 6 characters' };
    expect(getAuthErrorMessage(error)).toBe(
      'Password is too weak. Please use at least 6 characters.'
    );
  });

  it('should return friendly message for already registered email', () => {
    const error = { message: 'User already registered' };
    expect(getAuthErrorMessage(error)).toBe(
      'An account with this email already exists. Try signing in instead.'
    );
  });

  it('should return friendly message for invalid email', () => {
    const error = { message: 'invalid email format' };
    expect(getAuthErrorMessage(error)).toBe(
      'Please enter a valid email address.'
    );
  });

  it('should return original message for unknown errors', () => {
    const error = { message: 'Some unknown error occurred' };
    expect(getAuthErrorMessage(error)).toBe('Some unknown error occurred');
  });

  it('should return fallback message when no message provided', () => {
    const error = {};
    expect(getAuthErrorMessage(error)).toBe(
      'An unexpected error occurred. Please try again.'
    );
  });

  it('should handle null error gracefully', () => {
    expect(getAuthErrorMessage(null)).toBe(
      'An unexpected error occurred. Please try again.'
    );
  });

  it('should handle undefined error gracefully', () => {
    expect(getAuthErrorMessage(undefined)).toBe(
      'An unexpected error occurred. Please try again.'
    );
  });
});

