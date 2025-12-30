// CustomDay.tsx
import React from 'react';
import { TouchableOpacity, Text, View, StyleSheet } from 'react-native';
import { DateData } from 'react-native-calendars';
import { useEffectiveColorScheme } from '@/components/theme';
import { Colors } from '@/constants/Colors';

interface CustomDayProps {
  date?: DateData;
  state?: 'selected' | 'disabled' | 'inactive' | 'today' | '';
  marking?: any;
  onPress?: (date: DateData) => void;
  onLongPress?: (date: DateData) => void;
}

const CustomDay: React.FC<CustomDayProps> = ({ date, state, marking, onPress, onLongPress }) => {
  const colorScheme = useEffectiveColorScheme();
  const colors = Colors[colorScheme];
  
  if (!date) return null;

  const isToday = state === 'today';
  const isDisabled = state === 'disabled';
  const isInactive = state === 'inactive';
  
  // Get the background color from marking
  const backgroundColor = marking?.customStyles?.container?.backgroundColor || 'transparent';
  const hasMarking = backgroundColor !== 'transparent';
  
  // Text color - use theme-aware colors
  const textColor = hasMarking 
    ? '#ffffff' 
    : isDisabled 
    ? colors.mutedForeground + '80'
    : isToday 
    ? colors.primary 
    : colors.text;

  const handlePress = () => {
    if (onPress && !isDisabled) {
      onPress(date);
    }
  };

  const handleLongPress = () => {
    if (onLongPress && !isDisabled) {
      onLongPress(date);
    }
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      onLongPress={handleLongPress}
      disabled={isDisabled}
      style={[
        styles.container,
        { backgroundColor },
        hasMarking && styles.marked,
        isToday && !hasMarking && { borderWidth: 1, borderColor: colors.primary },
      ]}
    >
      <Text
        style={[
          styles.text,
          { color: textColor },
          isDisabled && styles.disabledText,
          hasMarking && styles.markedText,
        ]}
      >
        {date.day}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
  },
  marked: {
    // Background color comes from inline style
  },
  today: {
    borderWidth: 1,
    borderColor: '#7c3aed', // primary color - actual border color set inline for theme support
  },
  text: {
    fontSize: 16,
    fontWeight: '400',
  },
  markedText: {
    fontWeight: 'bold',
  },
  disabledText: {
    opacity: 0.3,
  },
});

export default CustomDay;



