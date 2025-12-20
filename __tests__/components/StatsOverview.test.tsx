// __tests__/components/StatsOverview.test.tsx
import { render, screen } from '@testing-library/react-native';
import React from 'react';
import StatsOverview from '../../components/analytics/StatsOverview';

describe('StatsOverview', () => {
  const defaultStats = {
    totalWorkoutDays: 15,
    mostCommonExercise: 'Bench Press',
    averageExercisesPerDay: 4.5,
    averageSetsPerDay: 12.3,
  };

  it('should render all stat values', () => {
    render(<StatsOverview stats={defaultStats} />);

    expect(screen.getByText(/Total Workout Days: 15/)).toBeTruthy();
    expect(screen.getByText(/Most Common Exercise: Bench Press/)).toBeTruthy();
    expect(screen.getByText(/Average Exercises per Day: 4.5/)).toBeTruthy();
    expect(screen.getByText(/Average Sets per Day: 12.3/)).toBeTruthy();
  });

  it('should render Overview subtitle', () => {
    render(<StatsOverview stats={defaultStats} />);

    expect(screen.getByText('Overview')).toBeTruthy();
  });

  it('should display N/A for empty mostCommonExercise', () => {
    const stats = {
      ...defaultStats,
      mostCommonExercise: '',
    };

    render(<StatsOverview stats={stats} />);

    expect(screen.getByText(/Most Common Exercise: N\/A/)).toBeTruthy();
  });

  it('should format decimal values to one decimal place', () => {
    const stats = {
      totalWorkoutDays: 10,
      mostCommonExercise: 'Squats',
      averageExercisesPerDay: 3.33333,
      averageSetsPerDay: 9.99999,
    };

    render(<StatsOverview stats={stats} />);

    // toFixed(1) should round appropriately
    expect(screen.getByText(/Average Exercises per Day: 3.3/)).toBeTruthy();
    expect(screen.getByText(/Average Sets per Day: 10.0/)).toBeTruthy();
  });

  it('should handle zero values', () => {
    const stats = {
      totalWorkoutDays: 0,
      mostCommonExercise: '',
      averageExercisesPerDay: 0,
      averageSetsPerDay: 0,
    };

    render(<StatsOverview stats={stats} />);

    expect(screen.getByText(/Total Workout Days: 0/)).toBeTruthy();
    expect(screen.getByText(/Average Exercises per Day: 0.0/)).toBeTruthy();
    expect(screen.getByText(/Average Sets per Day: 0.0/)).toBeTruthy();
  });

  it('should handle large numbers', () => {
    const stats = {
      totalWorkoutDays: 1000,
      mostCommonExercise: 'Deadlift',
      averageExercisesPerDay: 100.5,
      averageSetsPerDay: 500.9,
    };

    render(<StatsOverview stats={stats} />);

    expect(screen.getByText(/Total Workout Days: 1000/)).toBeTruthy();
    expect(screen.getByText(/Average Exercises per Day: 100.5/)).toBeTruthy();
    expect(screen.getByText(/Average Sets per Day: 500.9/)).toBeTruthy();
  });
});
