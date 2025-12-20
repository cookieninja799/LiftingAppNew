// __tests__/unit/workoutBackup.test.ts
// Tests for workout backup format and validation

import {
    BackupValidationError,
    createWorkoutBackup,
    parseWorkoutBackup,
    stringifyWorkoutBackup
} from '../../utils/data/workoutBackup';
import {
    emptySessions,
    multipleSessions,
    sessionsWithMissingMuscleGroup,
    singleSession,
} from '../fixtures/sessions';

describe('createWorkoutBackup', () => {
  it('should create a backup with correct structure', () => {
    const backup = createWorkoutBackup(singleSession);

    expect(backup.schemaVersion).toBe(1);
    expect(backup.exportedAt).toBeDefined();
    expect(backup.workoutSessions).toEqual(singleSession);
    expect(new Date(backup.exportedAt).getTime()).toBeGreaterThan(0);
  });

  it('should handle empty sessions array', () => {
    const backup = createWorkoutBackup(emptySessions);

    expect(backup.schemaVersion).toBe(1);
    expect(backup.workoutSessions).toEqual([]);
  });

  it('should include all sessions', () => {
    const backup = createWorkoutBackup(multipleSessions);

    expect(backup.workoutSessions).toHaveLength(multipleSessions.length);
    expect(backup.workoutSessions).toEqual(multipleSessions);
  });
});

describe('stringifyWorkoutBackup', () => {
  it('should stringify backup to valid JSON', () => {
    const backup = createWorkoutBackup(singleSession);
    const json = stringifyWorkoutBackup(backup);

    expect(typeof json).toBe('string');
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it('should produce formatted JSON with indentation', () => {
    const backup = createWorkoutBackup(singleSession);
    const json = stringifyWorkoutBackup(backup);

    // Should have newlines (formatted)
    expect(json).toContain('\n');
    expect(json).toContain('schemaVersion');
    expect(json).toContain('exportedAt');
    expect(json).toContain('workoutSessions');
  });
});

describe('parseWorkoutBackup', () => {
  describe('valid backups', () => {
    it('should parse a valid backup string', () => {
      const backup = createWorkoutBackup(singleSession);
      const json = stringifyWorkoutBackup(backup);
      const parsed = parseWorkoutBackup(json);

      expect(parsed.schemaVersion).toBe(1);
      expect(parsed.workoutSessions).toHaveLength(singleSession.length);
      expect(parsed.workoutSessions[0]).toMatchObject({
        id: singleSession[0].id,
        date: singleSession[0].date,
      });
    });

    it('should round-trip multiple sessions', () => {
      const backup = createWorkoutBackup(multipleSessions);
      const json = stringifyWorkoutBackup(backup);
      const parsed = parseWorkoutBackup(json);

      expect(parsed.workoutSessions).toHaveLength(multipleSessions.length);
      expect(parsed.workoutSessions).toEqual(multipleSessions);
    });

    it('should normalize missing optional fields', () => {
      const backup = createWorkoutBackup(sessionsWithMissingMuscleGroup);
      const json = stringifyWorkoutBackup(backup);
      const parsed = parseWorkoutBackup(json);

      expect(parsed.workoutSessions[0].exercises[0].primaryMuscleGroup).toBeUndefined();
      expect(parsed.workoutSessions[0].exercises[1].primaryMuscleGroup).toBe('Chest');
    });

    it('should handle empty sessions array', () => {
      const backup = createWorkoutBackup(emptySessions);
      const json = stringifyWorkoutBackup(backup);
      const parsed = parseWorkoutBackup(json);

      expect(parsed.workoutSessions).toEqual([]);
    });
  });

  describe('invalid backups', () => {
    it('should reject invalid JSON', () => {
      expect(() => parseWorkoutBackup('not json')).toThrow(BackupValidationError);
      expect(() => parseWorkoutBackup('{ invalid json }')).toThrow(BackupValidationError);
    });

    it('should reject non-object root', () => {
      expect(() => parseWorkoutBackup('[]')).toThrow(BackupValidationError);
      expect(() => parseWorkoutBackup('"string"')).toThrow(BackupValidationError);
      expect(() => parseWorkoutBackup('123')).toThrow(BackupValidationError);
    });

    it('should reject missing schemaVersion', () => {
      const invalid = {
        exportedAt: new Date().toISOString(),
        workoutSessions: [],
      };
      expect(() => parseWorkoutBackup(JSON.stringify(invalid))).toThrow(BackupValidationError);
    });

    it('should reject wrong schemaVersion', () => {
      const invalid = {
        schemaVersion: 2,
        exportedAt: new Date().toISOString(),
        workoutSessions: [],
      };
      expect(() => parseWorkoutBackup(JSON.stringify(invalid))).toThrow(BackupValidationError);
      expect(() => parseWorkoutBackup(JSON.stringify(invalid))).toThrow('Unsupported backup schema version');
    });

    it('should reject missing exportedAt', () => {
      const invalid = {
        schemaVersion: 1,
        workoutSessions: [],
      };
      expect(() => parseWorkoutBackup(JSON.stringify(invalid))).toThrow(BackupValidationError);
    });

    it('should reject missing workoutSessions', () => {
      const invalid = {
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
      };
      expect(() => parseWorkoutBackup(JSON.stringify(invalid))).toThrow(BackupValidationError);
    });

    it('should reject workoutSessions that is not an array', () => {
      const invalid = {
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        workoutSessions: {},
      };
      expect(() => parseWorkoutBackup(JSON.stringify(invalid))).toThrow(BackupValidationError);
    });

    it('should reject session missing id', () => {
      const invalid = {
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        workoutSessions: [
          {
            date: '2024-12-18',
            exercises: [],
          },
        ],
      };
      expect(() => parseWorkoutBackup(JSON.stringify(invalid))).toThrow(BackupValidationError);
      expect(() => parseWorkoutBackup(JSON.stringify(invalid))).toThrow('missing or invalid "id"');
    });

    it('should reject session missing date', () => {
      const invalid = {
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        workoutSessions: [
          {
            id: 'session-1',
            exercises: [],
          },
        ],
      };
      expect(() => parseWorkoutBackup(JSON.stringify(invalid))).toThrow(BackupValidationError);
      expect(() => parseWorkoutBackup(JSON.stringify(invalid))).toThrow('missing or invalid "date"');
    });

    it('should reject session with invalid date format', () => {
      const invalid = {
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        workoutSessions: [
          {
            id: 'session-1',
            date: 'invalid-date',
            exercises: [],
          },
        ],
      };
      expect(() => parseWorkoutBackup(JSON.stringify(invalid))).toThrow(BackupValidationError);
      expect(() => parseWorkoutBackup(JSON.stringify(invalid))).toThrow('invalid date format');
    });

    it('should reject session with non-array exercises', () => {
      const invalid = {
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        workoutSessions: [
          {
            id: 'session-1',
            date: '2024-12-18',
            exercises: {},
          },
        ],
      };
      expect(() => parseWorkoutBackup(JSON.stringify(invalid))).toThrow(BackupValidationError);
    });

    it('should reject exercise missing id', () => {
      const invalid = {
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        workoutSessions: [
          {
            id: 'session-1',
            date: '2024-12-18',
            exercises: [
              {
                exercise: 'Bench Press',
                sets: 3,
                reps: [10, 10, 10],
                weights: ['135', '135', '135'],
              },
            ],
          },
        ],
      };
      expect(() => parseWorkoutBackup(JSON.stringify(invalid))).toThrow(BackupValidationError);
      expect(() => parseWorkoutBackup(JSON.stringify(invalid))).toThrow('missing or invalid "id"');
    });

    it('should reject exercise missing exercise name', () => {
      const invalid = {
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        workoutSessions: [
          {
            id: 'session-1',
            date: '2024-12-18',
            exercises: [
              {
                id: 'ex-1',
                sets: 3,
                reps: [10, 10, 10],
                weights: ['135', '135', '135'],
              },
            ],
          },
        ],
      };
      expect(() => parseWorkoutBackup(JSON.stringify(invalid))).toThrow(BackupValidationError);
      expect(() => parseWorkoutBackup(JSON.stringify(invalid))).toThrow('missing or invalid "exercise"');
    });

    it('should reject exercise missing sets', () => {
      const invalid = {
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        workoutSessions: [
          {
            id: 'session-1',
            date: '2024-12-18',
            exercises: [
              {
                id: 'ex-1',
                exercise: 'Bench Press',
                reps: [10, 10, 10],
                weights: ['135', '135', '135'],
              },
            ],
          },
        ],
      };
      expect(() => parseWorkoutBackup(JSON.stringify(invalid))).toThrow(BackupValidationError);
      expect(() => parseWorkoutBackup(JSON.stringify(invalid))).toThrow('missing or invalid "sets"');
    });

    it('should reject exercise with negative sets', () => {
      const invalid = {
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        workoutSessions: [
          {
            id: 'session-1',
            date: '2024-12-18',
            exercises: [
              {
                id: 'ex-1',
                exercise: 'Bench Press',
                sets: -1,
                reps: [],
                weights: [],
              },
            ],
          },
        ],
      };
      expect(() => parseWorkoutBackup(JSON.stringify(invalid))).toThrow(BackupValidationError);
    });

    it('should reject exercise with non-array reps', () => {
      const invalid = {
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        workoutSessions: [
          {
            id: 'session-1',
            date: '2024-12-18',
            exercises: [
              {
                id: 'ex-1',
                exercise: 'Bench Press',
                sets: 3,
                reps: {},
                weights: [],
              },
            ],
          },
        ],
      };
      expect(() => parseWorkoutBackup(JSON.stringify(invalid))).toThrow(BackupValidationError);
    });

    it('should reject exercise with non-array weights', () => {
      const invalid = {
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        workoutSessions: [
          {
            id: 'session-1',
            date: '2024-12-18',
            exercises: [
              {
                id: 'ex-1',
                exercise: 'Bench Press',
                sets: 3,
                reps: [],
                weights: {},
              },
            ],
          },
        ],
      };
      expect(() => parseWorkoutBackup(JSON.stringify(invalid))).toThrow(BackupValidationError);
    });
  });

  describe('round-trip integrity', () => {
    it('should preserve all data through round-trip', () => {
      const original = createWorkoutBackup(multipleSessions);
      const json = stringifyWorkoutBackup(original);
      const parsed = parseWorkoutBackup(json);

      expect(parsed.schemaVersion).toBe(original.schemaVersion);
      expect(parsed.exportedAt).toBe(original.exportedAt);
      expect(parsed.workoutSessions).toEqual(original.workoutSessions);
    });

    it('should preserve exercise details including optional fields', () => {
      const sessions = [
        {
          id: 'session-1',
          date: '2024-12-18',
          exercises: [
            {
              id: 'ex-1',
              exercise: 'Bench Press',
              sets: 3,
              reps: [10, 8, 6],
              weights: ['135', '155', '175'],
              primaryMuscleGroup: 'Chest',
            },
            {
              id: 'ex-2',
              exercise: 'Squats',
              sets: 4,
              reps: [12, 10, 8, 6],
              weights: ['185', '205', '225', '245'],
              // primaryMuscleGroup intentionally missing
            },
          ],
        },
      ];

      const backup = createWorkoutBackup(sessions);
      const json = stringifyWorkoutBackup(backup);
      const parsed = parseWorkoutBackup(json);

      expect(parsed.workoutSessions[0].exercises[0].primaryMuscleGroup).toBe('Chest');
      expect(parsed.workoutSessions[0].exercises[1].primaryMuscleGroup).toBeUndefined();
    });
  });
});
