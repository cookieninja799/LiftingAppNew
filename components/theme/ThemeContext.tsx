import { vars } from 'nativewind';
import React, { createContext, startTransition, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform, useColorScheme as useSystemColorScheme, View } from 'react-native';
import { getThemePreference, setThemePreference as saveThemePreference } from './storage';
import { EffectiveScheme, ThemePreference } from './types';

// RGB values for theme tokens (converted from HSL)
const lightThemeVars = vars({
  '--background': '255 255 255',
  '--foreground': '8 12 29',
  '--card': '255 255 255',
  '--card-foreground': '8 12 29',
  '--popover': '255 255 255',
  '--popover-foreground': '8 12 29',
  '--primary': '124 58 237',
  '--primary-foreground': '248 250 252',
  '--secondary': '241 245 249',
  '--secondary-foreground': '30 41 59',
  '--muted': '241 245 249',
  '--muted-foreground': '100 116 139',
  '--accent': '241 245 249',
  '--accent-foreground': '30 41 59',
  '--destructive': '239 68 68',
  '--destructive-foreground': '248 250 252',
  '--border': '226 232 240',
  '--input': '226 232 240',
  '--ring': '124 58 237',
});

const darkThemeVars = vars({
  '--background': '2 8 23',
  '--foreground': '248 250 252',
  '--card': '2 8 23',
  '--card-foreground': '248 250 252',
  '--popover': '2 8 23',
  '--popover-foreground': '248 250 252',
  '--primary': '109 40 217',
  '--primary-foreground': '248 250 252',
  '--secondary': '30 41 59',
  '--secondary-foreground': '248 250 252',
  '--muted': '30 41 59',
  '--muted-foreground': '148 163 184',
  '--accent': '30 41 59',
  '--accent-foreground': '248 250 252',
  '--destructive': '127 29 29',
  '--destructive-foreground': '248 250 252',
  '--border': '30 41 59',
  '--input': '30 41 59',
  '--ring': '109 40 217',
});

interface ThemeContextValue {
  preference: ThemePreference;
  effectiveScheme: EffectiveScheme;
  setPreference: (preference: ThemePreference) => void;
  isLoading: boolean;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useSystemColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [isLoading, setIsLoading] = useState(true);

  // Load saved preference on mount
  useEffect(() => {
    getThemePreference().then((saved) => {
      setPreferenceState(saved);
      setIsLoading(false);
    });
  }, []);

  const setPreference = useCallback((newPreference: ThemePreference) => {
    // Wrap in startTransition to mark theme changes as non-urgent updates
    // This prevents interrupting navigation context during renders
    startTransition(() => {
      setPreferenceState(newPreference);
    });
    saveThemePreference(newPreference);
  }, []);

  const effectiveScheme: EffectiveScheme = useMemo(() => {
    if (preference === 'system') {
      return systemScheme ?? 'light';
    }
    return preference;
  }, [preference, systemScheme]);

  const value = useMemo(
    () => ({ preference, effectiveScheme, setPreference, isLoading }),
    [preference, effectiveScheme, setPreference, isLoading]
  );

  // Apply CSS variables for native platforms
  const themeStyle = effectiveScheme === 'dark' ? darkThemeVars : lightThemeVars;

  return (
    <ThemeContext.Provider value={value}>
      {Platform.OS === 'web' ? (
        // On web, we apply the dark class to enable CSS variable switching
        <View style={{ flex: 1 }} className={effectiveScheme === 'dark' ? 'dark' : ''}>
          {children}
        </View>
      ) : (
        // On native, we inject CSS variables via nativewind vars
        <View style={[{ flex: 1 }, themeStyle]}>
          {children}
        </View>
      )}
    </ThemeContext.Provider>
  );
}

export function useThemeContext() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useThemeContext must be used within a ThemeProvider');
  }
  return context;
}

// Re-export the effective scheme as a drop-in replacement for useColorScheme
export function useEffectiveColorScheme(): EffectiveScheme {
  const { effectiveScheme } = useThemeContext();
  return effectiveScheme;
}
