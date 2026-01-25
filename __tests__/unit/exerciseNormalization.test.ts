import { normalizeExerciseName, getSimilarExercises } from '../../utils/exerciseNormalization';

describe('normalizeExerciseName', () => {
  it('normalizes plurals and casing', () => {
    const result = normalizeExerciseName('Cable Rows');
    expect(result.canonical).toBe('cable row');
    expect(result.confidence).toBe('high');
  });

  it('normalizes directional cable fly variants', () => {
    const lowHigh = normalizeExerciseName('Low-high cable flies');
    const lowToHigh = normalizeExerciseName('low to high cable flies');
    expect(lowHigh.canonical).toBe('cable fly low high');
    expect(lowToHigh.canonical).toBe('cable fly low high');
  });

  it('expands common abbreviations', () => {
    const result = normalizeExerciseName('DB bench press');
    expect(result.canonical).toBe('dumbbell bench press');
  });
});

describe('getSimilarExercises', () => {
  it('finds exercises with the same canonical form', () => {
    const exercises = ['Cable Row', 'cable rows', 'Lat Pulldown'];
    const matches = getSimilarExercises('cable row', exercises);
    expect(matches).toEqual(['Cable Row', 'cable rows']);
  });
});
