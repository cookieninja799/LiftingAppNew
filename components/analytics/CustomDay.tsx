// CustomDay.tsx
import React from 'react';
import { TouchableOpacity, Text, View, StyleSheet } from 'react-native';
import { DateData } from 'react-native-calendars';

interface CustomDayProps {
  date?: DateData;
  state?: 'selected' | 'disabled' | 'inactive' | 'today' | '';
  marking?: any;
  onPress?: (date: DateData) => void;
  onLongPress?: (date: DateData) => void;
}

const CustomDay: React.FC<CustomDayProps> = ({ date, state, marking, onPress, onLongPress }) => {
  if (!date) return null;

  const isToday = state === 'today';
  const isDisabled = state === 'disabled';
  const isInactive = state === 'inactive';
  
  // Get the background color from marking
  const backgroundColor = marking?.customStyles?.container?.backgroundColor || 'transparent';
  const hasMarking = backgroundColor !== 'transparent';
  
  // Text color
  const textColor = hasMarking 
    ? '#ffffff' 
    : isDisabled 
    ? '#d1d5db' 
    : isToday 
    ? '#6366f1' 
    : '#000000';

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
        isToday && !hasMarking && styles.today,
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
    borderColor: '#6366f1',
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



