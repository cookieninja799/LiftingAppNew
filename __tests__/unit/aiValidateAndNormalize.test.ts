// __tests__/unit/aiValidateAndNormalize.test.ts
// Unit tests for AI validation and normalization

import { validateAndNormalize } from '@/ai/validateAndNormalize';

describe('validateAndNormalize', () => {
  const defaultDateFactory = () => '2024-01-15';
  const defaultIdFactory = () => 'test-id-1';

  describe('schema validation', () => {
    it('should reject empty arrays', () => {
      const result = validateAndNormalize([], {
        dateFactory: defaultDateFactory,
        idFactory: defaultIdFactory,
      });

      expect(result.success).toBe(false);
      expect(result.warnings).toContain('No exercises found in parsed data');
      expect(result.confidence).toBe('low');
    });

    it('should reject non-array, non-object inputs', () => {
      const result = validateAndNormalize('not valid', {
        dateFactory: defaultDateFactory,
        idFactory: defaultIdFactory,
      });

      expect(result.success).toBe(false);
      expect(result.warnings).toContain('No exercises found in parsed data');
    });

    it('should accept array of exercises', () => {
      const result = validateAndNormalize(
        [
          {
            exercise: 'Bench Press',
            sets: 3,
            reps: [10, 10, 10],
            weights: ['135', '135', '135'],
          },
        ],
        {
          dateFactory: defaultDateFactory,
          idFactory: defaultIdFactory,
        }
      );

      expect(result.success).toBe(true);
      expect(result.exercises).toHaveLength(1);
      expect(result.exercises![0].exercise).toBe('Bench Press');
    });

    it('should accept object with exercises array', () => {
      const result = validateAndNormalize(
        {
          exercises: [
            {
              exercise: 'Squat',
              sets: 5,
              reps: [5, 5, 5, 5, 5],
              weights: ['225', '225', '225', '225', '225'],
            },
          ],
        },
        {
          dateFactory: defaultDateFactory,
          idFactory: defaultIdFactory,
        }
      );

      expect(result.success).toBe(true);
      expect(result.exercises).toHaveLength(1);
      expect(result.exercises![0].exercise).toBe('Squat');
    });
  });

  describe('normalization', () => {
    it('should default date when missing', () => {
      const result = validateAndNormalize(
        [
          {
            exercise: 'Deadlift',
            sets: 1,
            reps: [5],
            weights: ['315'],
          },
        ],
        {
          dateFactory: defaultDateFactory,
          idFactory: defaultIdFactory,
        }
      );

      expect(result.success).toBe(true);
      expect(result.exercises![0].date).toBe('2024-01-15');
      expect(result.warnings).toContain('No date provided; defaulted to today.');
    });

    it('should normalize invalid date format', () => {
      const result = validateAndNormalize(
        [
          {
            exercise: 'OHP',
            sets: 3,
            reps: [8, 8, 8],
            weights: ['95', '95', '95'],
            date: 'invalid-date',
          },
        ],
        {
          dateFactory: defaultDateFactory,
          idFactory: defaultIdFactory,
        }
      );

      expect(result.success).toBe(true);
      expect(result.exercises![0].date).toBe('2024-01-15');
      expect(result.warnings.some((w) => w.includes('Invalid date format'))).toBe(true);
    });

    it('should normalize reps array lengths', () => {
      const result = validateAndNormalize(
        [
          {
            exercise: 'Bench Press',
            sets: 3,
            reps: [10, 10], // Only 2 reps but 3 sets
            weights: ['135', '135', '135'],
          },
        ],
        {
          dateFactory: defaultDateFactory,
          idFactory: defaultIdFactory,
        }
      );

      expect(result.success).toBe(true);
      expect(result.exercises![0].reps).toHaveLength(3);
      expect(result.exercises![0].reps![2]).toBe(0); // Padded with 0
    });

    it('should normalize weights array lengths', () => {
      const result = validateAndNormalize(
        [
          {
            exercise: 'Squat',
            sets: 3,
            reps: [5, 5, 5],
            weights: ['225'], // Only 1 weight but 3 sets
          },
        ],
        {
          dateFactory: defaultDateFactory,
          idFactory: defaultIdFactory,
        }
      );

      expect(result.success).toBe(true);
      expect(result.exercises![0].weights).toHaveLength(3);
      expect(result.exercises![0].weights![1]).toBe('0'); // Padded with '0'
      expect(result.exercises![0].weights![2]).toBe('0');
    });

    it('should handle numeric weights', () => {
      const result = validateAndNormalize(
        [
          {
            exercise: 'Bench Press',
            sets: 2,
            reps: [10, 10],
            weights: [135, 145], // Numbers instead of strings
          },
        ],
        {
          dateFactory: defaultDateFactory,
          idFactory: defaultIdFactory,
        }
      );

      expect(result.success).toBe(true);
      expect(result.exercises![0].weights![0]).toBe('135');
      expect(result.exercises![0].weights![1]).toBe('145');
    });

    it('should use template muscles when enabled', () => {
      const result = validateAndNormalize(
        [
          {
            exercise: 'bench press',
            sets: 3,
            reps: [10, 10, 10],
            weights: ['135', '135', '135'],
          },
        ],
        {
          useTemplateMuscles: true,
          dateFactory: defaultDateFactory,
          idFactory: defaultIdFactory,
        }
      );

      expect(result.success).toBe(true);
      expect(result.exercises![0].primaryMuscleGroup).toBe('Chest');
      expect(result.exercises![0].muscleContributions).toBeDefined();
    });

    it('should not use template muscles when disabled', () => {
      const result = validateAndNormalize(
        [
          {
            exercise: 'bench press',
            sets: 3,
            reps: [10, 10, 10],
            weights: ['135', '135', '135'],
          },
        ],
        {
          useTemplateMuscles: false,
          allowModelProvidedMuscles: false,
          dateFactory: defaultDateFactory,
          idFactory: defaultIdFactory,
        }
      );

      expect(result.success).toBe(true);
      expect(result.exercises![0].primaryMuscleGroup).toBeUndefined();
    });
  });

  describe('confidence scoring', () => {
    it('should return low confidence for many zeros', () => {
      const result = validateAndNormalize(
        [
          {
            exercise: 'Bench Press',
            sets: 3,
            reps: [0, 0, 0],
            weights: ['0', '0', '0'],
          },
        ],
        {
          dateFactory: defaultDateFactory,
          idFactory: defaultIdFactory,
        }
      );

      expect(result.success).toBe(true);
      expect(result.confidence).toBe('low');
    });

    it('should return high confidence for valid data', () => {
      const result = validateAndNormalize(
        [
          {
            exercise: 'Bench Press',
            sets: 3,
            reps: [10, 10, 10],
            weights: ['135', '135', '135'],
          },
        ],
        {
          dateFactory: defaultDateFactory,
          idFactory: defaultIdFactory,
        }
      );

      expect(result.success).toBe(true);
      expect(result.confidence).toBe('high');
    });

    it('should return low confidence for single exercise with few sets', () => {
      const result = validateAndNormalize(
        [
          {
            exercise: 'Bench Press',
            sets: 1,
            reps: [10],
            weights: ['135'],
          },
        ],
        {
          dateFactory: defaultDateFactory,
          idFactory: defaultIdFactory,
        }
      );

      expect(result.success).toBe(true);
      expect(result.confidence).toBe('low');
    });

    it('should return low confidence for many warnings', () => {
      const result = validateAndNormalize(
        [
          {
            exercise: 'Exercise 1',
            sets: 1,
            reps: [],
            weights: [],
            date: 'invalid',
          },
          {
            exercise: 'Exercise 2',
            sets: 1,
            reps: [],
            weights: [],
            date: 'invalid',
          },
          {
            exercise: 'Exercise 3',
            sets: 1,
            reps: [],
            weights: [],
            date: 'invalid',
          },
        ],
        {
          dateFactory: defaultDateFactory,
          idFactory: defaultIdFactory,
        }
      );

      expect(result.success).toBe(true);
      expect(result.confidence).toBe('low');
    });
  });
});

