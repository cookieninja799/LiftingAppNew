// CalendarHeatMap.tsx
import { useEffectiveColorScheme } from '@/components/theme';
import { Colors } from '@/constants/Colors';
import React, { useMemo } from 'react';
import { Calendar } from 'react-native-calendars';
import { getColorForTotalSets } from '../../utils/helpers';
import CustomDay from './CustomDay';

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

    const formattedMarkedDates = useMemo(() => {
      const result: Record<string, any> = {};
      
      console.log('[CalendarHeatMap] Building marked dates...');
      console.log('[CalendarHeatMap] Input markedDates:', markedDates);
      console.log('[CalendarHeatMap] maxTotalSets:', maxTotalSets);
      
      Object.keys(markedDates).forEach(date => {
        const totalSets = markedDates[date] || 0;
        const hasActivity = maxTotalSets > 0 && totalSets > 0;
        const backgroundColor = hasActivity
          ? getColorForTotalSets(totalSets, maxTotalSets, colorScheme)
          : undefined;
        
        console.log(`[CalendarHeatMap] Date ${date}: totalSets=${totalSets}, hasActivity=${hasActivity}, color=${backgroundColor}`);
        
        if (hasActivity && backgroundColor) {
          // Use customStyles only for the heatmap effect
          result[date] = {
            customStyles: {
              container: {
                backgroundColor,
                borderRadius: 4, 
              },
              text: {
                color: '#ffffff',
                fontWeight: 'bold' as const,
              },
            },
          };
          console.log(`[CalendarHeatMap] Added marking for ${date}:`, result[date]);
        }
      });
      
      console.log('[CalendarHeatMap] Final result:', JSON.stringify(result, null, 2));
      return result;
    }, [markedDates, maxTotalSets, colorScheme]);

    // Get the most recent date with activity to show that month by default
    const initialDate = useMemo(() => {
      const dates = Object.keys(markedDates).sort().reverse(); // Sort descending
      return dates.length > 0 ? dates[0] : undefined;
    }, [markedDates]);

    return (
      <Calendar
        markingType="custom"
        markedDates={formattedMarkedDates}
        current={initialDate}
        dayComponent={CustomDay}
        style={{ backgroundColor: calendarBg }}
        theme={{
          calendarBackground: calendarBg,
          textSectionTitleColor: colors.mutedForeground,
          dayTextColor: colors.text,
          monthTextColor: colors.text,
          arrowColor: colors.primary,
          todayTextColor: colors.text,
          textDisabledColor: colors.mutedForeground + '50',
        }}
      />
    );
};
  
export default CalendarHeatMap;
