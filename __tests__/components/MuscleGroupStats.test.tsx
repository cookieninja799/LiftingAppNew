// __tests__/components/MuscleGroupStats.test.tsx
import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import MuscleGroupStats from '../../components/analytics/MuscleGroupStats';
import { UncategorizedStats, WeeklySetsBreakdown } from '../../utils/analytics/calculateStats';

// Mock getCurrentWeek to return a fixed week for deterministic tests
jest.mock('../../utils/helpers', () => ({
  ...jest.requireActual('../../utils/helpers'),
  getCurrentWeek: () => '2024-W51',
  getVolumeStatus: (muscleGroup: string, totalWeeklySets: number, mode?: string) => {
    // Simplified mock for testing
    if (totalWeeklySets === 0) return '😴 No gains';
    if (totalWeeklySets < 6) return '😬 Too Low';
    if (totalWeeklySets >= 12 && totalWeeklySets <= 18) return '💪 Optimal';
    return '👍 Good';
  },
}));

// Helper to create stats with new shape
function createStats(data: Record<string, { totalVolume: number; averageVolume: number; direct: number; fractional: number; total: number; week?: string }>) {
  const stats: Record<string, { totalVolume: number; averageVolume: number; weeklySets: WeeklySetsBreakdown }> = {};
  
  for (const [group, values] of Object.entries(data)) {
    const week = values.week || '2024-W51';
    stats[group] = {
      totalVolume: values.totalVolume,
      averageVolume: values.averageVolume,
      weeklySets: {
        direct: { [week]: values.direct },
        fractional: { [week]: values.fractional },
        total: { [week]: values.total },
      },
    };
  }
  
  return stats;
}

describe('MuscleGroupStats', () => {
  it('should render muscle group names', () => {
    const stats = createStats({
      Chest: { totalVolume: 10000, averageVolume: 2500, direct: 12, fractional: 12, total: 12 },
      Back: { totalVolume: 12000, averageVolume: 3000, direct: 15, fractional: 15, total: 15 },
    });

    render(<MuscleGroupStats stats={stats} />);

    expect(screen.getByText('Chest')).toBeTruthy();
    expect(screen.getByText('Back')).toBeTruthy();
  });

  it('should display weekly fractional sets by default', () => {
    const stats = createStats({
      Chest: { totalVolume: 10000, averageVolume: 2500, direct: 8, fractional: 12, total: 15 },
    });

    render(<MuscleGroupStats stats={stats} />);

    // Default mode is 'fractional', should show 12 sets
    expect(screen.getByText('12 sets')).toBeTruthy();
  });

  it('should show 0 sets when muscle group has no data for current week', () => {
    const stats: Record<string, { totalVolume: number; averageVolume: number; weeklySets: WeeklySetsBreakdown }> = {
      Chest: {
        totalVolume: 10000,
        averageVolume: 2500,
        weeklySets: {
          direct: { '2024-W50': 10 }, // Different week
          fractional: { '2024-W50': 10 },
          total: { '2024-W50': 10 },
        },
      },
    };

    render(<MuscleGroupStats stats={stats} />);

    // Should fall back to 0 for current week
    expect(screen.getByText('0 sets')).toBeTruthy();
    // The component should show the "No gains" status
    expect(screen.getByText(/😴 No gains/)).toBeTruthy();
  });

  it('should display average volume', () => {
    const stats = createStats({
      Chest: { totalVolume: 10000, averageVolume: 2500, direct: 12, fractional: 12, total: 12 },
    });

    render(<MuscleGroupStats stats={stats} />);

    expect(screen.getByText(/2500/)).toBeTruthy();
  });

  it('should display 0 for undefined or NaN average volume', () => {
    const stats = createStats({
      Chest: { totalVolume: 0, averageVolume: NaN, direct: 0, fractional: 0, total: 0 },
    });

    render(<MuscleGroupStats stats={stats} />);

    // Component now shows "0" for NaN/falsy average volume
    expect(screen.getByText('0 lbs')).toBeTruthy();
  });

  it('should render empty state gracefully when stats is empty', () => {
    const stats = {};

    const { toJSON } = render(<MuscleGroupStats stats={stats} />);

    // Should render without crashing
    expect(toJSON()).toBeTruthy();
  });

  it('should display title', () => {
    const stats = createStats({
      Chest: { totalVolume: 10000, averageVolume: 2500, direct: 12, fractional: 12, total: 12 },
    });

    render(<MuscleGroupStats stats={stats} />);

    expect(screen.getByText(/Muscle Group Analysis/)).toBeTruthy();
  });

  it('should handle multiple muscle groups', () => {
    const stats = createStats({
      Chest: { totalVolume: 10000, averageVolume: 2500, direct: 12, fractional: 12, total: 12 },
      Back: { totalVolume: 12000, averageVolume: 3000, direct: 15, fractional: 15, total: 15 },
      Quads: { totalVolume: 8000, averageVolume: 4000, direct: 8, fractional: 8, total: 8 },
      Shoulders: { totalVolume: 5000, averageVolume: 1250, direct: 6, fractional: 6, total: 6 },
    });

    render(<MuscleGroupStats stats={stats} />);

    expect(screen.getByText('Chest')).toBeTruthy();
    expect(screen.getByText('Back')).toBeTruthy();
    expect(screen.getByText('Quads')).toBeTruthy();
    expect(screen.getByText('Shoulders')).toBeTruthy();
  });

  it('should show volume status message', () => {
    const stats = createStats({
      Chest: { totalVolume: 10000, averageVolume: 2500, direct: 12, fractional: 12, total: 12 },
    });

    render(<MuscleGroupStats stats={stats} />);

    // Based on our mock, 12 sets should show "💪 Optimal"
    expect(screen.getByText(/💪 Optimal/)).toBeTruthy();
  });

  it('should display valid non-zero average volume', () => {
    const stats = createStats({
      Chest: { totalVolume: 5000, averageVolume: 1000, direct: 5, fractional: 5, total: 5 },
    });

    render(<MuscleGroupStats stats={stats} />);

    // Non-zero average should be displayed
    expect(screen.getByText(/1000/)).toBeTruthy();
  });

  describe('Segmented Control Mode Toggle', () => {
    it('should render the segmented control with Direct/Fractional/Total options', () => {
      const stats = createStats({
        Chest: { totalVolume: 10000, averageVolume: 2500, direct: 8, fractional: 12, total: 15 },
      });

      render(<MuscleGroupStats stats={stats} />);

      expect(screen.getByText('Direct')).toBeTruthy();
      expect(screen.getByText('Fractional')).toBeTruthy();
      expect(screen.getByText('Total')).toBeTruthy();
    });

    it('should change displayed set count when toggling mode', () => {
      const stats = createStats({
        Chest: { totalVolume: 10000, averageVolume: 2500, direct: 8, fractional: 12, total: 15 },
      });

      render(<MuscleGroupStats stats={stats} />);

      // Default is fractional (12 sets)
      expect(screen.getByText('12 sets')).toBeTruthy();

      // Toggle to Direct
      fireEvent.press(screen.getByText('Direct'));
      expect(screen.getByText('8 sets')).toBeTruthy();

      // Toggle to Total
      fireEvent.press(screen.getByText('Total'));
      expect(screen.getByText('15 sets')).toBeTruthy();
    });

    it('should format fractional sets with decimals when needed', () => {
      const stats = createStats({
        Chest: { totalVolume: 10000, averageVolume: 2500, direct: 3, fractional: 4.5, total: 6 },
      });

      render(<MuscleGroupStats stats={stats} />);

      // Fractional mode shows 4.5 sets
      expect(screen.getByText('4.5 sets')).toBeTruthy();
    });
  });

  describe('Uncategorized Sets Display', () => {
    it('should display uncategorized sets when present', () => {
      const stats = createStats({
        Chest: { totalVolume: 10000, averageVolume: 2500, direct: 12, fractional: 12, total: 12 },
      });

      const uncategorized: UncategorizedStats = {
        weeklySets: { '2024-W51': 5 },
        weeklyExerciseCount: { '2024-W51': 2 },
      };

      render(<MuscleGroupStats stats={stats} uncategorized={uncategorized} />);

      expect(screen.getByText(/Uncategorized sets this week: 5/)).toBeTruthy();
    });

    it('should not display uncategorized notice when no uncategorized sets', () => {
      const stats = createStats({
        Chest: { totalVolume: 10000, averageVolume: 2500, direct: 12, fractional: 12, total: 12 },
      });

      const uncategorized: UncategorizedStats = {
        weeklySets: {},
        weeklyExerciseCount: {},
      };

      render(<MuscleGroupStats stats={stats} uncategorized={uncategorized} />);

      expect(screen.queryByText(/Uncategorized sets/)).toBeNull();
    });
  });
});
