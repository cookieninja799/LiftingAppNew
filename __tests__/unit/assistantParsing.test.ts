// __tests__/unit/assistantParsing.test.ts
import {
    extractJsonTextBlocks,
    parseAssistantExercises,
    parseAssistantResponse
} from '../../utils/assistantParsing';
import {
    emptyPayload,
    invalidJsonPayload,
    missingFieldsPayload,
    multipleJsonBlocksPayload,
    nonTextMessagePayload,
    nullMessagesPayload,
    objectWithExercisesPayload,
    payloadWithProse,
    singleExercisePayload,
    standardArrayPayload,
} from '../fixtures/assistantPayloads';

// Deterministic ID factory for testing
let idCounter = 0;
const testIdFactory = () => `test-id-${++idCounter}`;
const testDateFactory = () => '2024-12-19';

beforeEach(() => {
  idCounter = 0;
});

describe('extractJsonTextBlocks', () => {
  it('should extract JSON text from standard array payload', () => {
    const blocks = extractJsonTextBlocks(standardArrayPayload);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toContain('Bench Press');
    expect(blocks[0]).toContain('Squats');
  });

  it('should extract JSON text from object with exercises payload', () => {
    const blocks = extractJsonTextBlocks(objectWithExercisesPayload);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toContain('exercises');
    expect(blocks[0]).toContain('Deadlift');
  });

  it('should handle payload with prose - only extract JSON blocks', () => {
    const blocks = extractJsonTextBlocks(payloadWithProse);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toContain('Lat Pulldown');
    expect(blocks[0]).not.toContain('Great workout');
  });

  it('should extract from multiple JSON blocks', () => {
    const blocks = extractJsonTextBlocks(multipleJsonBlocksPayload);
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toContain('Barbell Row');
    expect(blocks[1]).toContain('Dumbbell Fly');
  });

  it('should return empty array for empty payload', () => {
    const blocks = extractJsonTextBlocks(emptyPayload);
    expect(blocks).toHaveLength(0);
  });

  it('should handle null/undefined messages', () => {
    const blocks = extractJsonTextBlocks(nullMessagesPayload);
    expect(blocks).toHaveLength(0);
  });

  it('should ignore non-text message types', () => {
    const blocks = extractJsonTextBlocks(nonTextMessagePayload);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toContain('Cable Crossover');
  });

  it('should extract invalid JSON as text block (parsing happens later)', () => {
    const blocks = extractJsonTextBlocks(invalidJsonPayload);
    // Invalid JSON starts with '{' so it gets extracted, but will fail parsing
    expect(blocks).toHaveLength(2);
  });
});

describe('parseAssistantExercises', () => {
  it('should parse JSON array root format', () => {
    const blocks = extractJsonTextBlocks(standardArrayPayload);
    const exercises = parseAssistantExercises(blocks, {
      idFactory: testIdFactory,
      dateFactory: testDateFactory,
    });

    expect(exercises).toHaveLength(2);
    expect(exercises[0]).toMatchObject({
      exercise: 'Bench Press',
      sets: 3,
      reps: [10, 8, 6],
      weights: ['135', '155', '175'],
      primaryMuscleGroup: 'Chest',
      date: '2024-12-18',
    });
    expect(exercises[1]).toMatchObject({
      exercise: 'Squats',
      sets: 4,
      primaryMuscleGroup: 'Quads',
    });
  });

  it('should parse object with exercises array format', () => {
    const blocks = extractJsonTextBlocks(objectWithExercisesPayload);
    const exercises = parseAssistantExercises(blocks, {
      idFactory: testIdFactory,
      dateFactory: testDateFactory,
    });

    expect(exercises).toHaveLength(2);
    expect(exercises[0].exercise).toBe('Deadlift');
    expect(exercises[0].date).toBe('2024-12-17');
    expect(exercises[1].exercise).toBe('Pull-ups');
    // Pull-ups has no date, should default to testDateFactory
    expect(exercises[1].date).toBe('2024-12-19');
  });

  it('should parse single exercise object', () => {
    const blocks = extractJsonTextBlocks(singleExercisePayload);
    const exercises = parseAssistantExercises(blocks, {
      idFactory: testIdFactory,
      dateFactory: testDateFactory,
    });

    expect(exercises).toHaveLength(1);
    expect(exercises[0]).toMatchObject({
      exercise: 'Overhead Press',
      sets: 4,
      primaryMuscleGroup: 'Shoulders',
    });
  });

  it('should apply defaults for missing fields', () => {
    const blocks = extractJsonTextBlocks(missingFieldsPayload);
    const exercises = parseAssistantExercises(blocks, {
      idFactory: testIdFactory,
      dateFactory: testDateFactory,
    });

    expect(exercises).toHaveLength(2);
    
    // First exercise - missing sets, reps, weights, date
    expect(exercises[0]).toMatchObject({
      exercise: 'Bicep Curls',
      sets: 1, // default
      reps: [], // default
      weights: [], // default
      date: '2024-12-19', // default from dateFactory
    });

    // Second exercise - missing reps, weights
    expect(exercises[1]).toMatchObject({
      exercise: 'Tricep Dips',
      sets: 3,
      reps: [], // default
      weights: [], // default
      primaryMuscleGroup: 'Arms',
    });
  });

  it('should use "Unknown Exercise" for missing exercise name', () => {
    const blocks = ['{"sets": 3, "reps": [10, 10, 10]}'];
    const exercises = parseAssistantExercises(blocks, {
      idFactory: testIdFactory,
      dateFactory: testDateFactory,
    });

    expect(exercises).toHaveLength(1);
    expect(exercises[0].exercise).toBe('Unknown Exercise');
  });

  it('should ignore invalid JSON blocks', () => {
    const blocks = extractJsonTextBlocks(invalidJsonPayload);
    const exercises = parseAssistantExercises(blocks, {
      idFactory: testIdFactory,
      dateFactory: testDateFactory,
    });

    // Only the valid JSON should be parsed
    expect(exercises).toHaveLength(1);
    expect(exercises[0].exercise).toBe('Leg Press');
  });

  it('should assign unique IDs to each exercise', () => {
    const blocks = extractJsonTextBlocks(standardArrayPayload);
    const exercises = parseAssistantExercises(blocks, {
      idFactory: testIdFactory,
      dateFactory: testDateFactory,
    });

    expect(exercises[0].id).toBe('test-id-1');
    expect(exercises[1].id).toBe('test-id-2');
  });
});

describe('parseAssistantResponse (convenience function)', () => {
  it('should combine extract and parse in one call', () => {
    const exercises = parseAssistantResponse(standardArrayPayload, {
      idFactory: testIdFactory,
      dateFactory: testDateFactory,
    });

    expect(exercises).toHaveLength(2);
    expect(exercises[0].exercise).toBe('Bench Press');
    expect(exercises[1].exercise).toBe('Squats');
  });

  it('should handle empty payload', () => {
    const exercises = parseAssistantResponse(emptyPayload);
    expect(exercises).toHaveLength(0);
  });
});
