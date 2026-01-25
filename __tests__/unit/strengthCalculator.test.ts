import { calculateWeightForReps, estimateWeightFromSimilarExercise, getPercentageForReps } from '@/utils/pr/strengthCalculator';

describe('strengthCalculator', () => {
  it('getPercentageForReps returns closest percentage', () => {
    expect(getPercentageForReps(9, 'hypertrophy')).toBe(0.75);
    expect(getPercentageForReps(4, 'strength')).toBe(0.9);
  });

  it('calculateWeightForReps rounds to nearest 2.5', () => {
    const weight = calculateWeightForReps({ estimated1RM: 200, targetReps: 8, goal: 'hypertrophy' });
    expect(weight).toBe(150);
  });

  it('estimateWeightFromSimilarExercise uses ratio and reps', () => {
    const result = estimateWeightFromSimilarExercise({
      similarExercise1RM: 250,
      strengthRatio: 0.85,
      targetReps: 8,
      goal: 'hypertrophy',
    });
    expect(result.estimated1RM).toBeCloseTo(212.5, 1);
    expect(result.recommendedWeight).toBe(160);
  });
});
