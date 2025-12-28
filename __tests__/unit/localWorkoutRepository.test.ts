// __tests__/unit/localWorkoutRepository.test.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LocalWorkoutRepository } from '../../data/LocalWorkoutRepository';
import { WorkoutSession } from '../../utils/workoutSessions';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

describe('LocalWorkoutRepository', () => {
  let repository: LocalWorkoutRepository;
  const mockGetItem = AsyncStorage.getItem as jest.MockedFunction<typeof AsyncStorage.getItem>;
  const mockSetItem = AsyncStorage.setItem as jest.MockedFunction<typeof AsyncStorage.setItem>;

  beforeEach(() => {
    repository = new LocalWorkoutRepository();
    jest.clearAllMocks();
    mockGetItem.mockReset();
    mockSetItem.mockReset();
    mockGetItem.mockResolvedValue(null);
  });

  describe('Migration from v0 to v1', () => {
    it('should migrate v0 sessions to v1 normalized structure', async () => {
      const v0Data = [
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
          ],
        },
      ];

      mockGetItem
        .mockResolvedValueOnce(null) // migration version check
        .mockResolvedValueOnce(JSON.stringify(v0Data)) // workout sessions
        .mockResolvedValueOnce(null); // listSessions call

      mockSetItem.mockResolvedValue(undefined);

      const sessions = await repository.listSessions();

      expect(mockSetItem).toHaveBeenCalled();
      const savedData = JSON.parse(mockSetItem.mock.calls[0][1] as string);
      
      expect(savedData).toHaveLength(1);
      expect(savedData[0]).toHaveProperty('performedOn', '2024-12-18');
      expect(savedData[0]).not.toHaveProperty('date');
      expect(savedData[0].exercises[0]).toHaveProperty('nameRaw', 'Bench Press');
      expect(savedData[0].exercises[0]).not.toHaveProperty('exercise');
      expect(savedData[0].exercises[0]).toHaveProperty('sets');
      expect(Array.isArray(savedData[0].exercises[0].sets)).toBe(true);
      expect(savedData[0].exercises[0].sets).toHaveLength(3);
      expect(savedData[0].exercises[0].sets[0]).toMatchObject({
        reps: 10,
        weightText: '135',
      });
    });

    it('should preserve exercise IDs during migration', async () => {
      const v0Data = [
        {
          id: 'existing-session-id',
          date: '2024-12-18',
          exercises: [
            {
              id: 'existing-ex-id',
              exercise: 'Squats',
              sets: 2,
              reps: [10, 8],
              weights: ['185', '205'],
            },
          ],
        },
      ];

      mockGetItem
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(JSON.stringify(v0Data))
        .mockResolvedValueOnce(null);

      mockSetItem.mockResolvedValue(undefined);

      await repository.listSessions();

      const savedData = JSON.parse(mockSetItem.mock.calls[0][1] as string);
      expect(savedData[0].id).toBe('existing-session-id');
      expect(savedData[0].exercises[0].id).toBe('existing-ex-id');
    });

    it('should generate IDs for sessions/exercises that lack them', async () => {
      const v0Data = [
        {
          date: '2024-12-18',
          exercises: [
            {
              exercise: 'Bench Press',
              sets: 1,
              reps: [10],
              weights: ['135'],
            },
          ],
        },
      ];

      mockGetItem
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(JSON.stringify(v0Data))
        .mockResolvedValueOnce(null);

      mockSetItem.mockResolvedValue(undefined);

      await repository.listSessions();

      const savedData = JSON.parse(mockSetItem.mock.calls[0][1] as string);
      expect(savedData[0].id).toBeDefined();
      expect(savedData[0].exercises[0].id).toBeDefined();
      expect(savedData[0].exercises[0].sets[0].id).toBeDefined();
    });

    it('should set timestamps during migration', async () => {
      const v0Data = [
        {
          id: 'session-1',
          date: '2024-12-18',
          exercises: [
            {
              id: 'ex-1',
              exercise: 'Bench Press',
              sets: 1,
              reps: [10],
              weights: ['135'],
            },
          ],
        },
      ];

      mockGetItem
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(JSON.stringify(v0Data))
        .mockResolvedValueOnce(null);

      mockSetItem.mockResolvedValue(undefined);

      await repository.listSessions();

      const savedData = JSON.parse(mockSetItem.mock.calls[0][1] as string);
      expect(savedData[0].updatedAt).toBeDefined();
      expect(savedData[0].createdAt).toBeDefined();
      expect(savedData[0].deletedAt).toBeNull();
      expect(savedData[0].exercises[0].updatedAt).toBeDefined();
      expect(savedData[0].exercises[0].sets[0].updatedAt).toBeDefined();
    });

    it('should not migrate if already on v1', async () => {
      const v1Data = [
        {
          id: 'session-1',
          performedOn: '2024-12-18',
          exercises: [
            {
              id: 'ex-1',
              sessionId: 'session-1',
              nameRaw: 'Bench Press',
              sets: [
                {
                  id: 'set-1',
                  exerciseId: 'ex-1',
                  setIndex: 0,
                  reps: 10,
                  weightText: '135',
                  isBodyweight: false,
                  updatedAt: '2024-12-18T12:00:00.000Z',
                  createdAt: '2024-12-18T12:00:00.000Z',
                },
              ],
              updatedAt: '2024-12-18T12:00:00.000Z',
              createdAt: '2024-12-18T12:00:00.000Z',
            },
          ],
          updatedAt: '2024-12-18T12:00:00.000Z',
          createdAt: '2024-12-18T12:00:00.000Z',
          deletedAt: null,
        },
      ];

      mockGetItem
        .mockResolvedValueOnce('v1') // Already migrated
        .mockResolvedValueOnce(JSON.stringify(v1Data));

      const sessions = await repository.listSessions();

      expect(mockSetItem).not.toHaveBeenCalled();
      expect(sessions).toHaveLength(1);
      expect(sessions[0].performedOn).toBe('2024-12-18');
    });
  });

  describe('Soft delete handling', () => {
    it('should exclude soft-deleted sessions from listSessions', async () => {
      const now = new Date().toISOString();
      const sessions: WorkoutSession[] = [
        {
          id: 'session-1',
          performedOn: '2024-12-18',
          exercises: [],
          updatedAt: now,
          createdAt: now,
          deletedAt: null,
        },
        {
          id: 'session-2',
          performedOn: '2024-12-17',
          exercises: [],
          updatedAt: now,
          createdAt: now,
          deletedAt: now, // Soft deleted
        },
      ];

      mockGetItem
        .mockResolvedValueOnce('v1')
        .mockResolvedValueOnce(JSON.stringify(sessions));

      const result = await repository.listSessions();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('session-1');
    });

    it('should soft delete a session', async () => {
      const now = new Date().toISOString();
      const sessions: WorkoutSession[] = [
        {
          id: 'session-1',
          performedOn: '2024-12-18',
          exercises: [],
          updatedAt: now,
          createdAt: now,
          deletedAt: null,
        },
      ];

      mockGetItem
        .mockResolvedValueOnce('v1')
        .mockResolvedValueOnce(JSON.stringify(sessions));

      mockSetItem.mockResolvedValue(undefined);

      await repository.softDeleteSession('session-1');

      expect(mockSetItem).toHaveBeenCalled();
      const savedData = JSON.parse(mockSetItem.mock.calls[0][1] as string);
      expect(savedData[0].deletedAt).toBeDefined();
      expect(savedData[0].deletedAt).not.toBeNull();
    });
  });

  describe('Upsert operations', () => {
    it('should update existing session', async () => {
      const now = new Date().toISOString();
      const existing: WorkoutSession[] = [
        {
          id: 'session-1',
          performedOn: '2024-12-18',
          exercises: [],
          updatedAt: now,
          createdAt: now,
          deletedAt: null,
        },
      ];

      const updated: WorkoutSession = {
        id: 'session-1',
        performedOn: '2024-12-18',
        exercises: [],
        updatedAt: now,
        createdAt: now,
        deletedAt: null,
        title: 'Updated Title',
      };

      mockGetItem
        .mockResolvedValueOnce('v1')
        .mockResolvedValueOnce(JSON.stringify(existing));

      mockSetItem.mockResolvedValue(undefined);

      // Wait a tiny bit to ensure Date.now() changes if needed, 
      // or we can just check if it's a valid ISO string
      await repository.upsertSession(updated);

      expect(mockSetItem).toHaveBeenCalled();
      const savedData = JSON.parse(mockSetItem.mock.calls[0][1] as string);
      expect(savedData[0].title).toBe('Updated Title');
      expect(savedData[0].updatedAt).toBeDefined();
    });

    it('should create new session if not exists', async () => {
      mockGetItem
        .mockResolvedValueOnce('v1')
        .mockResolvedValueOnce(JSON.stringify([]));

      mockSetItem.mockResolvedValue(undefined);

      const newSession: WorkoutSession = {
        id: 'new-session',
        performedOn: '2024-12-19',
        exercises: [],
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        deletedAt: null,
      };

      await repository.upsertSession(newSession);

      expect(mockSetItem).toHaveBeenCalled();
      const savedData = JSON.parse(mockSetItem.mock.calls[0][1] as string);
      expect(savedData).toHaveLength(1);
      expect(savedData[0].id).toBe('new-session');
    });
  });
});

