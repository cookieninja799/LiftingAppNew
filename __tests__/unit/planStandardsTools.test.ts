import { getPlanTool } from '@/ai/intents/planAgent/tools';

describe('planAgent standards tools', () => {
  it('get_strength_standard returns classification', () => {
    const tool = getPlanTool('get_strength_standard');
    if (!tool) throw new Error('Tool not found');

    const result = tool.handler({
      lift: 'bench',
      weight: 100,
      reps: 5,
      bodyweightKg: 75,
      ageBand: '20-29',
      sex: 'male',
    });

    expect(result.success).toBe(true);
    expect(result.classification).toBeDefined();
  });

  it('get_standards_adjustment returns range', () => {
    const tool = getPlanTool('get_standards_adjustment');
    if (!tool) throw new Error('Tool not found');

    const result = tool.handler({
      lift: 'squat',
      targetReps: 8,
      bodyweightKg: 75,
      ageBand: '20-29',
      sex: 'male',
    });

    expect(result.success).toBe(true);
    expect(result.suggestedRangeKg.min).toBeLessThan(result.suggestedRangeKg.max);
  });
});
