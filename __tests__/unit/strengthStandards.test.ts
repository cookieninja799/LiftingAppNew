import { classifyStrength, getNearestStandard, KILGORE_STANDARDS } from '@/ai/intents/planAgent/standards';

describe('strength standards lookup', () => {
  it('returns nearest standard by bodyweight', () => {
    const standard = getNearestStandard({
      sex: 'male',
      ageBand: '20-29',
      bodyweightKg: 78,
      lift: 'bench',
    });
    expect(standard).not.toBeNull();
    expect(standard?.bodyweightKg).toBe(75);
  });

  it('classifies strength level against standard', () => {
    const standard = KILGORE_STANDARDS.find(
      (entry) => entry.sex === 'male' && entry.lift === 'bench'
    );
    if (!standard) throw new Error('Standard not found');
    const result = classifyStrength({ estimated1RM: 140, standard });
    expect(['intermediate', 'advanced', 'elite']).toContain(result.classification);
  });
});
