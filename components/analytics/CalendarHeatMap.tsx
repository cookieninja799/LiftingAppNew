// CalendarHeatMap.tsx
import { useEffectiveColorScheme } from '@/components/theme';
import { Colors } from '@/constants/Colors';
import React, { useMemo } from 'react';
import { Calendar } from 'react-native-calendars';
import { getColorForTotalSets } from '../../utils/helpers';

interface CalendarHeatMapProps {
    markedDates: Record<string, number>; // Number of sets per day
}
  
const CalendarHeatMap: React.FC<CalendarHeatMapProps> = ({ markedDates }) => {
    const colorScheme = useEffectiveColorScheme();
    const colors = Colors[colorScheme];
    const calendarBg = colorScheme === 'dark' ? colors.card : '#ffffff';

    const maxTotalSets = useMemo(() => {
      const totals = Object.values(markedDates);
      if (!totals.length) return 0;
      return Math.max(...totals);
    }, [markedDates]);

    const formattedMarkedDates = Object.keys(markedDates).reduce((acc, date) => {
        const totalSets = markedDates[date] || 0;
        const hasActivity = maxTotalSets > 0 && totalSets > 0;
        const backgroundColor = hasActivity
          ? getColorForTotalSets(totalSets, maxTotalSets, colorScheme)
          : 'transparent';
        acc[date] = {
            customStyles: {
                container: {
                    backgroundColor,
                    borderRadius: 4, 
                },
                text: {
                    // Keep text readable on both light and dark intensities
                    color: hasActivity ? '#ffffff' : colors.text,
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
        style={{ backgroundColor: calendarBg }}
        theme={{
          calendarBackground: calendarBg,
          textSectionTitleColor: colors.mutedForeground,
          dayTextColor: colors.text,
          monthTextColor: colors.text,
          arrowColor: colors.primary,
          todayTextColor: colors.primary,
          textDisabledColor: colors.mutedForeground + '50',
          // Force day cells and rows to inherit the calendar background on web
          stylesheet: {
            calendar: {
              main: {
                backgroundColor: calendarBg,
              },
              week: {
                backgroundColor: calendarBg,
              },
            },
            day: {
              basic: {
                base: {
                  backgroundColor: calendarBg,
                },
              },
            },
          },
        }}
      />
    );
};
  
export default CalendarHeatMap;
