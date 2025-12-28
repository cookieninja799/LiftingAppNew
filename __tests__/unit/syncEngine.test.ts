// __tests__/unit/syncEngine.test.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SyncEngine } from '../../data/SyncEngine';
import { CloudWorkoutRepository } from '../../data/CloudWorkoutRepository';
import { LocalWorkoutRepository } from '../../data/LocalWorkoutRepository';
import { WorkoutSession } from '../../utils/workoutSessions';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

// Mock repository classes
jest.mock('../../data/CloudWorkoutRepository');
jest.mock('../../data/LocalWorkoutRepository');

describe('SyncEngine', () => {
  let syncEngine: SyncEngine;
  let mockCloudRepo: jest.Mocked<CloudWorkoutRepository>;
  let mockLocalRepo: jest.Mocked<LocalWorkoutRepository>;
  const mockGetItem = AsyncStorage.getItem as jest.MockedFunction<typeof AsyncStorage.getItem>;
  const mockSetItem = AsyncStorage.setItem as jest.MockedFunction<typeof AsyncStorage.setItem>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetItem.mockResolvedValue(null);
    mockSetItem.mockResolvedValue(undefined);

    // Create mock instances
    mockCloudRepo = {
      listSessions: jest.fn(),
      getWorkoutSession: jest.fn(),
      upsertSession: jest.fn(),
      softDeleteSession: jest.fn(),
    } as any;

    mockLocalRepo = {
      listSessions: jest.fn(),
      getWorkoutSession: jest.fn(),
      upsertSession: jest.fn(),
      softDeleteSession: jest.fn(),
    } as any;

    // Mock constructors to return our mock instances
    (CloudWorkoutRepository as jest.MockedClass<typeof CloudWorkoutRepository>).mockImplementation(() => mockCloudRepo);
    (LocalWorkoutRepository as jest.MockedClass<typeof LocalWorkoutRepository>).mockImplementation(() => mockLocalRepo);

    syncEngine = new SyncEngine();
  });

  describe('migrateLocalToCloud', () => {
    it('should migrate local sessions to cloud on first run', async () => {
      const now = new Date().toISOString();
      const localSessions: WorkoutSession[] = [
        {
          id: 'local-1',
          performedOn: '2024-12-18',
          exercises: [],
          updatedAt: now,
          createdAt: now,
          deletedAt: null,
        },
      ];

      mockLocalRepo.listSessions.mockResolvedValue(localSessions);
      mockCloudRepo.upsertSession.mockResolvedValue(undefined);
      mockGetItem.mockResolvedValue(null); // Not migrated yet

      await syncEngine.migrateLocalToCloud();

      expect(mockCloudRepo.upsertSession).toHaveBeenCalledWith(localSessions[0]);
      expect(mockSetItem).toHaveBeenCalledWith('has_migrated_to_cloud', 'true');
    });

    it('should not migrate if already migrated', async () => {
      mockGetItem.mockResolvedValue('true'); // Already migrated

      await syncEngine.migrateLocalToCloud();

      expect(mockLocalRepo.listSessions).not.toHaveBeenCalled();
      expect(mockCloudRepo.upsertSession).not.toHaveBeenCalled();
    });

    it('should handle migration errors gracefully', async () => {
      const now = new Date().toISOString();
      const localSessions: WorkoutSession[] = [
        {
          id: 'local-1',
          performedOn: '2024-12-18',
          exercises: [],
          updatedAt: now,
          createdAt: now,
          deletedAt: null,
        },
        {
          id: 'local-2',
          performedOn: '2024-12-17',
          exercises: [],
          updatedAt: now,
          createdAt: now,
          deletedAt: null,
        },
      ];

      mockLocalRepo.listSessions.mockResolvedValue(localSessions);
      mockCloudRepo.upsertSession
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Network error'));

      mockGetItem.mockResolvedValue(null);

      await syncEngine.migrateLocalToCloud();

      // Should still mark as migrated even if one session failed
      expect(mockSetItem).toHaveBeenCalledWith('has_migrated_to_cloud', 'true');
    });
  });

  describe('syncNow', () => {
    it('should pull new remote sessions to local', async () => {
      const now = new Date().toISOString();
      const remoteSessions: WorkoutSession[] = [
        {
          id: 'remote-1',
          performedOn: '2024-12-19',
          exercises: [],
          updatedAt: now,
          createdAt: now,
          deletedAt: null,
        },
      ];

      mockCloudRepo.listSessions.mockResolvedValue(remoteSessions);
      mockLocalRepo.listSessions.mockResolvedValue([]);
      mockLocalRepo.upsertSession.mockResolvedValue(undefined);
      mockGetItem.mockResolvedValue(null); // No last sync

      const result = await syncEngine.syncNow();

      expect(result.pulled).toBe(1);
      expect(result.pushed).toBe(0);
      expect(mockLocalRepo.upsertSession).toHaveBeenCalledWith(remoteSessions[0]);
    });

    it('should push new local sessions to cloud', async () => {
      const now = new Date().toISOString();
      const localSessions: WorkoutSession[] = [
        {
          id: 'local-1',
          performedOn: '2024-12-19',
          exercises: [],
          updatedAt: now,
          createdAt: now,
          deletedAt: null,
        },
      ];

      mockCloudRepo.listSessions.mockResolvedValue([]);
      mockLocalRepo.listSessions.mockResolvedValue(localSessions);
      mockCloudRepo.upsertSession.mockResolvedValue(undefined);
      mockGetItem.mockResolvedValue(null);

      const result = await syncEngine.syncNow();

      expect(result.pulled).toBe(0);
      expect(result.pushed).toBe(1);
      expect(mockCloudRepo.upsertSession).toHaveBeenCalledWith(localSessions[0]);
    });

    it('should update local if remote is newer', async () => {
      const oldTime = '2024-12-18T10:00:00.000Z';
      const newTime = '2024-12-18T12:00:00.000Z';
      
      const localSession: WorkoutSession = {
        id: 'shared-1',
        performedOn: '2024-12-18',
        exercises: [],
        updatedAt: oldTime,
        createdAt: oldTime,
        deletedAt: null,
      };

      const remoteSession: WorkoutSession = {
        id: 'shared-1',
        performedOn: '2024-12-18',
        exercises: [],
        updatedAt: newTime, // Newer
        createdAt: oldTime,
        deletedAt: null,
        title: 'Updated Title',
      };

      mockCloudRepo.listSessions.mockResolvedValue([remoteSession]);
      mockLocalRepo.listSessions.mockResolvedValue([localSession]);
      mockLocalRepo.upsertSession.mockResolvedValue(undefined);
      mockGetItem.mockResolvedValue(oldTime);

      const result = await syncEngine.syncNow();

      expect(result.pulled).toBe(1);
      expect(mockLocalRepo.upsertSession).toHaveBeenCalledWith(remoteSession);
    });

    it('should push local if local is newer', async () => {
      const oldTime = '2024-12-18T10:00:00.000Z';
      const newTime = '2024-12-18T12:00:00.000Z';
      
      const localSession: WorkoutSession = {
        id: 'shared-1',
        performedOn: '2024-12-18',
        exercises: [],
        updatedAt: newTime, // Newer
        createdAt: oldTime,
        deletedAt: null,
        title: 'Local Update',
      };

      const remoteSession: WorkoutSession = {
        id: 'shared-1',
        performedOn: '2024-12-18',
        exercises: [],
        updatedAt: oldTime,
        createdAt: oldTime,
        deletedAt: null,
      };

      mockCloudRepo.listSessions.mockResolvedValue([remoteSession]);
      mockLocalRepo.listSessions.mockResolvedValue([localSession]);
      mockCloudRepo.upsertSession.mockResolvedValue(undefined);
      mockGetItem.mockResolvedValue(oldTime);

      const result = await syncEngine.syncNow();

      expect(result.pushed).toBe(1);
      expect(mockCloudRepo.upsertSession).toHaveBeenCalledWith(localSession);
    });

    it('should not sync if timestamps are equal', async () => {
      const sameTime = '2024-12-18T12:00:00.000Z';
      
      const localSession: WorkoutSession = {
        id: 'shared-1',
        performedOn: '2024-12-18',
        exercises: [],
        updatedAt: sameTime,
        createdAt: sameTime,
        deletedAt: null,
      };

      const remoteSession: WorkoutSession = {
        id: 'shared-1',
        performedOn: '2024-12-18',
        exercises: [],
        updatedAt: sameTime,
        createdAt: sameTime,
        deletedAt: null,
      };

      mockCloudRepo.listSessions.mockResolvedValue([remoteSession]);
      mockLocalRepo.listSessions.mockResolvedValue([localSession]);
      mockGetItem.mockResolvedValue(sameTime);

      const result = await syncEngine.syncNow();

      expect(result.pulled).toBe(0);
      expect(result.pushed).toBe(0);
      expect(mockLocalRepo.upsertSession).not.toHaveBeenCalled();
      expect(mockCloudRepo.upsertSession).not.toHaveBeenCalled();
    });

    it('should update lastSyncAt after successful sync', async () => {
      mockCloudRepo.listSessions.mockResolvedValue([]);
      mockLocalRepo.listSessions.mockResolvedValue([]);
      mockGetItem.mockResolvedValue(null);

      await syncEngine.syncNow();

      expect(mockSetItem).toHaveBeenCalledWith(
        'last_sync_at',
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
      );
    });

    it('should handle empty sessions gracefully', async () => {
      mockCloudRepo.listSessions.mockResolvedValue([]);
      mockLocalRepo.listSessions.mockResolvedValue([]);
      mockGetItem.mockResolvedValue(null);

      const result = await syncEngine.syncNow();

      expect(result.pulled).toBe(0);
      expect(result.pushed).toBe(0);
    });
  });

  describe('getLastSyncTime', () => {
    it('should return last sync time from storage', async () => {
      const syncTime = '2024-12-18T12:00:00.000Z';
      mockGetItem.mockResolvedValue(syncTime);

      const result = await syncEngine.getLastSyncTime();

      expect(result).toBe(syncTime);
      expect(mockGetItem).toHaveBeenCalledWith('last_sync_at');
    });

    it('should return null if never synced', async () => {
      mockGetItem.mockResolvedValue(null);

      const result = await syncEngine.getLastSyncTime();

      expect(result).toBeNull();
    });
  });
});

