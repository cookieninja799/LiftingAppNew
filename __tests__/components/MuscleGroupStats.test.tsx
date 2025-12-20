// __tests__/components/MuscleGroupStats.test.tsx
import { render, screen } from '@testing-library/react-native';
import React from 'react';
import MuscleGroupStats from '../../components/analytics/MuscleGroupStats';

// Mock getCurrentWeek to return a fixed week for deterministic tests
jest.mock('../../utils/helpers', () => ({
  ...jest.requireActual('../../utils/helpers'),
  getCurrentWeek: () => '2024-W51',
  getVolumeStatus: (muscleGroup: string, totalWeeklySets: number) => {
    // Simplified mock for testing
    if (totalWeeklySets === 0) return '😴 No gains';
    if (totalWeeklySets < 6) return '😬 Too Low';
    if (totalWeeklySets >= 12 && totalWeeklySets <= 18) return '💪 Optimal';
    return '👍 Good';
  },
}));

describe('MuscleGroupStats', () => {
  it('should render muscle group names', () => {
    const stats = {
      Chest: {
        totalVolume: 10000,
        averageVolume: 2500,
        weeklySets: { '2024-W51': 12 },
      },
      Back: {
        totalVolume: 12000,
        averageVolume: 3000,
        weeklySets: { '2024-W51': 15 },
      },
    };

    render(<MuscleGroupStats stats={stats} />);

    expect(screen.getByText('Chest:')).toBeTruthy();
    expect(screen.getByText('Back:')).toBeTruthy();
  });

  it('should display weekly total sets for current week', () => {
    const stats = {
      Chest: {
        totalVolume: 10000,
        averageVolume: 2500,
        weeklySets: { '2024-W51': 12 },
      },
    };

    render(<MuscleGroupStats stats={stats} />);

    // Should show 12 sets for the current week
    expect(screen.getByText(/12/)).toBeTruthy();
  });

  it('should show 0 sets when muscle group has no data for current week', () => {
    const stats = {
      Chest: {
        totalVolume: 10000,
        averageVolume: 2500,
        weeklySets: { '2024-W50': 10 }, // Different week
      },
    };

    render(<MuscleGroupStats stats={stats} />);

    // Should fall back to 0 for current week - look for Total weekly sets: 0
    expect(screen.getByText(/Total weekly sets:/)).toBeTruthy();
    // The component should show 0 sets and the "No gains" status
    expect(screen.getByText(/😴 No gains/)).toBeTruthy();
  });

  it('should display average volume', () => {
    const stats = {
      Chest: {
        totalVolume: 10000,
        averageVolume: 2500,
        weeklySets: { '2024-W51': 12 },
      },
    };

    render(<MuscleGroupStats stats={stats} />);

    expect(screen.getByText(/2500/)).toBeTruthy();
  });

  it('should display N/A for undefined or NaN average volume', () => {
    const stats = {
      Chest: {
        totalVolume: 0,
        averageVolume: NaN,
        weeklySets: { '2024-W51': 0 },
      },
    };

    render(<MuscleGroupStats stats={stats} />);

    expect(screen.getByText(/N\/A/)).toBeTruthy();
  });

  it('should render empty state gracefully when stats is empty', () => {
    const stats = {};

    const { toJSON } = render(<MuscleGroupStats stats={stats} />);

    // Should render without crashing
    expect(toJSON()).toBeTruthy();
  });

  it('should display subtitle', () => {
    const stats = {
      Chest: {
        totalVolume: 10000,
        averageVolume: 2500,
        weeklySets: { '2024-W51': 12 },
      },
    };

    render(<MuscleGroupStats stats={stats} />);

    expect(screen.getByText(/Muscle Group Stats/)).toBeTruthy();
  });

  it('should handle multiple muscle groups', () => {
    const stats = {
      Chest: {
        totalVolume: 10000,
        averageVolume: 2500,
        weeklySets: { '2024-W51': 12 },
      },
      Back: {
        totalVolume: 12000,
        averageVolume: 3000,
        weeklySets: { '2024-W51': 15 },
      },
      Quads: {
        totalVolume: 8000,
        averageVolume: 4000,
        weeklySets: { '2024-W51': 8 },
      },
      Shoulders: {
        totalVolume: 5000,
        averageVolume: 1250,
        weeklySets: { '2024-W51': 6 },
      },
    };

    render(<MuscleGroupStats stats={stats} />);

    expect(screen.getByText('Chest:')).toBeTruthy();
    expect(screen.getByText('Back:')).toBeTruthy();
    expect(screen.getByText('Quads:')).toBeTruthy();
    expect(screen.getByText('Shoulders:')).toBeTruthy();
  });

  it('should show volume status message', () => {
    const stats = {
      Chest: {
        totalVolume: 10000,
        averageVolume: 2500,
        weeklySets: { '2024-W51': 12 },
      },
    };

    render(<MuscleGroupStats stats={stats} />);

    // Based on our mock, 12 sets should show "💪 Optimal"
    expect(screen.getByText(/💪 Optimal/)).toBeTruthy();
  });

  it('should handle zero average volume correctly', () => {
    const stats = {
      Chest: {
        totalVolume: 0,
        averageVolume: 0,
        weeklySets: { '2024-W51': 0 },
      },
    };

    render(<MuscleGroupStats stats={stats} />);

    // Component treats 0 as falsy and displays N/A
    // This is expected behavior - when there's no volume, show N/A
    expect(screen.getByText(/N\/A/)).toBeTruthy();
  });

  it('should display valid non-zero average volume', () => {
    const stats = {
      Chest: {
        totalVolume: 5000,
        averageVolume: 1000,
        weeklySets: { '2024-W51': 5 },
      },
    };

    render(<MuscleGroupStats stats={stats} />);

    // Non-zero average should be displayed
    expect(screen.getByText(/1000/)).toBeTruthy();
  });
});
