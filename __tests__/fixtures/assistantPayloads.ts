// __tests__/fixtures/assistantPayloads.ts
// Canned AI/server payloads for testing parsing logic

import { AssistantResponse } from '../../utils/assistantParsing';

/**
 * Standard array format - multiple exercises in a JSON array
 */
export const standardArrayPayload: AssistantResponse = {
  messages: [
    [
      {
        type: 'text',
        text: {
          value: JSON.stringify([
            {
              exercise: 'Bench Press',
              sets: 3,
              reps: [10, 8, 6],
              weights: ['135', '155', '175'],
              primaryMuscleGroup: 'Chest',
              date: '2024-12-18',
            },
            {
              exercise: 'Squats',
              sets: 4,
              reps: [12, 10, 8, 6],
              weights: ['185', '205', '225', '245'],
              primaryMuscleGroup: 'Quads',
              date: '2024-12-18',
            },
          ]),
        },
      },
    ],
  ],
};

/**
 * Object with exercises array format
 */
export const objectWithExercisesPayload: AssistantResponse = {
  messages: [
    [
      {
        type: 'text',
        text: {
          value: JSON.stringify({
            exercises: [
              {
                exercise: 'Deadlift',
                sets: 5,
                reps: [5, 5, 5, 5, 5],
                weights: ['315', '315', '315', '315', '315'],
                primaryMuscleGroup: 'Back',
                date: '2024-12-17',
              },
              {
                exercise: 'Pull-ups',
                sets: 3,
                reps: [10, 8, 6],
                weights: ['bodyweight', 'bodyweight', 'bodyweight'],
                primaryMuscleGroup: 'Back',
              },
            ],
          }),
        },
      },
    ],
  ],
};

/**
 * Single exercise object (not in array)
 */
export const singleExercisePayload: AssistantResponse = {
  messages: [
    [
      {
        type: 'text',
        text: {
          value: JSON.stringify({
            exercise: 'Overhead Press',
            sets: 4,
            reps: [8, 8, 6, 6],
            weights: ['95', '95', '105', '105'],
            primaryMuscleGroup: 'Shoulders',
            date: '2024-12-16',
          }),
        },
      },
    ],
  ],
};

/**
 * Payload with missing fields - tests defaults
 */
export const missingFieldsPayload: AssistantResponse = {
  messages: [
    [
      {
        type: 'text',
        text: {
          value: JSON.stringify([
            {
              exercise: 'Bicep Curls',
              // missing sets, reps, weights, date, primaryMuscleGroup
            },
            {
              exercise: 'Tricep Dips',
              sets: 3,
              // missing reps, weights
              primaryMuscleGroup: 'Arms',
            },
          ]),
        },
      },
    ],
  ],
};

/**
 * Payload with extra prose - should ignore non-JSON text
 */
export const payloadWithProse: AssistantResponse = {
  messages: [
    [
      {
        type: 'text',
        text: {
          value: "Great workout! Here's what I recorded for you:",
        },
      },
      {
        type: 'text',
        text: {
          value: JSON.stringify([
            {
              exercise: 'Lat Pulldown',
              sets: 3,
              reps: [12, 10, 8],
              weights: ['120', '140', '160'],
              primaryMuscleGroup: 'Back',
              date: '2024-12-15',
            },
          ]),
        },
      },
      {
        type: 'text',
        text: {
          value: 'Keep up the great work! 💪',
        },
      },
    ],
  ],
};

/**
 * Multiple text blocks with JSON
 */
export const multipleJsonBlocksPayload: AssistantResponse = {
  messages: [
    [
      {
        type: 'text',
        text: {
          value: JSON.stringify({
            exercise: 'Barbell Row',
            sets: 4,
            reps: [10, 10, 8, 8],
            weights: ['135', '145', '155', '155'],
            primaryMuscleGroup: 'Back',
            date: '2024-12-14',
          }),
        },
      },
    ],
    [
      {
        type: 'text',
        text: {
          value: JSON.stringify({
            exercise: 'Dumbbell Fly',
            sets: 3,
            reps: [12, 12, 10],
            weights: ['30', '30', '35'],
            primaryMuscleGroup: 'Chest',
            date: '2024-12-14',
          }),
        },
      },
    ],
  ],
};

/**
 * Empty messages payload
 */
export const emptyPayload: AssistantResponse = {
  messages: [],
};

/**
 * Null/undefined messages
 */
export const nullMessagesPayload: AssistantResponse = {
  messages: undefined as any,
};

/**
 * Invalid JSON in text - should be ignored
 */
export const invalidJsonPayload: AssistantResponse = {
  messages: [
    [
      {
        type: 'text',
        text: {
          value: '{ invalid json here',
        },
      },
      {
        type: 'text',
        text: {
          value: JSON.stringify({
            exercise: 'Leg Press',
            sets: 4,
            reps: [15, 12, 10, 8],
            weights: ['270', '360', '450', '540'],
            primaryMuscleGroup: 'Quads',
            date: '2024-12-13',
          }),
        },
      },
    ],
  ],
};

/**
 * Non-text message types - should be ignored
 */
export const nonTextMessagePayload: AssistantResponse = {
  messages: [
    [
      {
        type: 'image',
        text: {
          value: JSON.stringify({ exercise: 'Should be ignored' }),
        },
      },
      {
        type: 'text',
        text: {
          value: JSON.stringify({
            exercise: 'Cable Crossover',
            sets: 3,
            reps: [15, 12, 10],
            weights: ['30', '35', '40'],
            primaryMuscleGroup: 'Chest',
            date: '2024-12-12',
          }),
        },
      },
    ],
  ],
};
