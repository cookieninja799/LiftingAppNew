// __tests__/unit/workoutBackup.test.ts
// Tests for workout backup format and validation (v2 normalized model)

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
  it('should create a backup with correct structure (v2)', () => {
    const backup = createWorkoutBackup(singleSession);

    expect(backup.schemaVersion).toBe(2);
    expect(backup.exportedAt).toBeDefined();
    expect(backup.workoutSessions).toEqual(singleSession);
    expect(new Date(backup.exportedAt).getTime()).toBeGreaterThan(0);
  });

  it('should handle empty sessions array', () => {
    const backup = createWorkoutBackup(emptySessions);

    expect(backup.schemaVersion).toBe(2);
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
    it('should parse a valid backup string (v2)', () => {
      const backup = createWorkoutBackup(singleSession);
      const json = stringifyWorkoutBackup(backup);
      const parsed = parseWorkoutBackup(json);

      expect(parsed.schemaVersion).toBe(2);
      expect(parsed.workoutSessions).toHaveLength(singleSession.length);
      expect(parsed.workoutSessions[0]).toMatchObject({
        id: singleSession[0].id,
        performedOn: singleSession[0].performedOn,
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

    it('should reject legacy schemaVersion 1 with migration message', () => {
      const legacy = {
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        workoutSessions: [],
      };
      expect(() => parseWorkoutBackup(JSON.stringify(legacy))).toThrow('Legacy backup version 1 not supported');
    });

    it('should reject unsupported schemaVersion', () => {
      const invalid = {
        schemaVersion: 3,
        exportedAt: new Date().toISOString(),
        workoutSessions: [],
      };
      expect(() => parseWorkoutBackup(JSON.stringify(invalid))).toThrow(BackupValidationError);
      expect(() => parseWorkoutBackup(JSON.stringify(invalid))).toThrow('Unsupported backup schema version');
    });

    it('should reject missing workoutSessions', () => {
      const invalid = {
        schemaVersion: 2,
        exportedAt: new Date().toISOString(),
      };
      expect(() => parseWorkoutBackup(JSON.stringify(invalid))).toThrow(BackupValidationError);
    });

    it('should reject workoutSessions that is not an array', () => {
      const invalid = {
        schemaVersion: 2,
        exportedAt: new Date().toISOString(),
        workoutSessions: {},
      };
      expect(() => parseWorkoutBackup(JSON.stringify(invalid))).toThrow(BackupValidationError);
    });

    it('should reject v2 session missing performedOn', () => {
      const invalid = {
        schemaVersion: 2,
        exportedAt: new Date().toISOString(),
        workoutSessions: [
          {
            id: 'session-1',
            exercises: [],
          },
        ],
      };
      expect(() => parseWorkoutBackup(JSON.stringify(invalid))).toThrow(BackupValidationError);
      expect(() => parseWorkoutBackup(JSON.stringify(invalid))).toThrow('is invalid for schema version 2');
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
  });
});

