// CalendarHeatMap.tsx
import { useColorScheme } from '@/components/useColorScheme';
import { Colors } from '@/constants/Colors';
import React from 'react';
import { Calendar } from 'react-native-calendars';
import { getColorForTotalSets } from '../../utils/helpers';

interface CalendarHeatMapProps {
    markedDates: Record<string, number>; // Number of sets per day
}
  
const CalendarHeatMap: React.FC<CalendarHeatMapProps> = ({ markedDates }) => {
    const colorScheme = useColorScheme() ?? 'light';
    const colors = Colors[colorScheme];

    const formattedMarkedDates = Object.keys(markedDates).reduce((acc, date) => {
        const totalSets = markedDates[date] || 0;
        acc[date] = {
            customStyles: {
                container: {
                    backgroundColor: getColorForTotalSets(totalSets),
                    borderRadius: 4, 
                },
                text: {
                    color: '#ffffff', // Keep text white for visibility on heatmap colors
                    fontWeight: 'bold',
                },
            },
        };
        return acc;
    }, {} as Record<string, any>);

    return (
      <Calendar
        markingType="custom"
        markedDates={formattedMarkedDates}
        theme={{
          calendarBackground: colors.card,
          textSectionTitleColor: colors.mutedForeground,
          dayTextColor: colors.text,
          monthTextColor: colors.text,
          arrowColor: colors.primary,
          todayTextColor: colors.primary,
          textDisabledColor: colors.mutedForeground + '50',
        }}
      />
    );
};
  
export default CalendarHeatMap;
