// __tests__/unit/aiExtractJson.test.ts
// Unit tests for JSON extraction

import { extractJson } from '@/ai/extractJson';

describe('extractJson', () => {
  it('should extract valid JSON object', () => {
    const result = extractJson('{"exercises": [{"exercise": "Bench Press"}]}');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.jsonText).toBe('{"exercises": [{"exercise": "Bench Press"}]}');
    }
  });

  it('should extract valid JSON array', () => {
    const result = extractJson('[{"exercise": "Squat"}, {"exercise": "Deadlift"}]');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.jsonText).toBe('[{"exercise": "Squat"}, {"exercise": "Deadlift"}]');
    }
  });

  it('should strip code fences', () => {
    const result = extractJson('```json\n{"exercises": []}\n```');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.jsonText).toBe('{"exercises": []}');
    }
  });

  it('should strip code fences without json label', () => {
    const result = extractJson('```\n{"exercises": []}\n```');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.jsonText).toBe('{"exercises": []}');
    }
  });

  it('should extract JSON from text with surrounding content', () => {
    const result = extractJson('Here is the JSON:\n{"exercises": [{"exercise": "Bench"}]}\nThat was it.');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.jsonText).toBe('{"exercises": [{"exercise": "Bench"}]}');
    }
  });

  it('should fail on empty string', () => {
    const result = extractJson('');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('no_json_found');
    }
  });

  it('should fail on non-JSON text', () => {
    const result = extractJson('This is just plain text');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('no_json_found');
    }
  });

  it('should fail on invalid JSON', () => {
    const result = extractJson('{"exercises": [invalid json}');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('invalid_json');
    }
  });

  it('should handle JSON with escaped quotes', () => {
    const result = extractJson('{"exercise": "Bench \\"Press\\""}');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.jsonText).toBe('{"exercise": "Bench \\"Press\\""}');
    }
  });
});

