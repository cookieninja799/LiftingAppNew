// Colors based on Shadcn UI (HSL to Hex)
const tintColorLight = '#7c3aed';
const tintColorDark = '#6d28d9';

export const Colors = {
  light: {
    text: '#020817',
    background: '#ffffff',
    tint: tintColorLight,
    tabIconDefault: '#94a3b8',
    tabIconSelected: tintColorLight,
    border: '#e2e8f0',
    card: '#ffffff',
    primary: '#7c3aed',
    muted: '#f1f5f9',
    mutedForeground: '#64748b',
    destructive: '#ef4444',
    secondary: '#f1f5f9',
    secondaryForeground: '#1e293b',
  },
  dark: {
    text: '#f8fafc',
    background: '#020817',
    tint: tintColorDark,
    tabIconDefault: '#64748b',
    tabIconSelected: tintColorDark,
    border: '#1e293b',
    card: '#020817',
    primary: '#6d28d9',
    muted: '#1e293b',
    mutedForeground: '#94a3b8',
    destructive: '#7f1d1d',
    secondary: '#1e293b',
    secondaryForeground: '#f8fafc',
  },
};

export default Colors;
