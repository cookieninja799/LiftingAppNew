import { supabase } from '../lib/supabase';
import { WorkoutRepository } from './WorkoutRepository';
import { WorkoutSession, WorkoutExercise, WorkoutSet } from '../utils/workoutSessions';

/**
 * Validates if a string is a valid UUID v4 format
 */
function isValidUUID(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

export class CloudWorkoutRepository implements WorkoutRepository {
  async listSessions(): Promise<WorkoutSession[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('workout_sessions')
      .select(`
        *,
        performed_on_utc_day,
        workout_exercises (
          *,
          workout_sets (*)
        )
      `)
      .eq('user_id', user.id)
      .order('performed_on', { ascending: false });

    if (error) {
      console.error('Error fetching cloud sessions:', error);
      return [];
    }

    return (data || []).map(this.mapToDomain);
  }

  async getWorkoutSession(id: string): Promise<WorkoutSession | null> {
    const { data, error } = await supabase
      .from('workout_sessions')
      .select(`
        *,
        performed_on_utc_day,
        workout_exercises (
          *,
          workout_sets (*)
        )
      `)
      .eq('id', id)
      .single();

    if (error || !data) {
      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching cloud session:', error);
      }
      return null;
    }

    return this.mapToDomain(data);
  }

  /**
   * Validates IDs before writing to the database
   */
  private assertValidId(id: string, context: string) {
    if (!isValidUUID(id)) {
      throw new Error(`${context} must be a valid UUID v4`);
    }
  }

  async upsertSession(session: WorkoutSession): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    this.assertValidId(session.id, 'Session id');
    const sessionId = session.id;
    
    // Get existing exercises for this session to identify which ones were deleted
    const { data: existingExercises } = await supabase
      .from('workout_exercises')
      .select('id')
      .eq('session_id', sessionId);

    // 1. Upsert Session
    const { error: sessionError } = await supabase
      .from('workout_sessions')
      .upsert({
        id: sessionId,
        user_id: user.id,
        performed_on: session.performedOn,
        title: session.title,
        notes: session.notes,
        source: session.source,
        updated_at: session.updatedAt,
        created_at: session.createdAt,
      });

    if (sessionError) {
      console.error('Session upsert error:', sessionError);
      throw sessionError;
    }

    // 2. Upsert Exercises
    if (session.exercises.length > 0) {
      // Map exercises with converted IDs and store the mapping
      const exerciseIdMap = new Map<string, string>();
      const exercisesToUpsert = session.exercises.map(ex => {
        const originalId = ex.id;
        this.assertValidId(originalId, 'Exercise id');
        const exerciseId = originalId;
        exerciseIdMap.set(originalId, exerciseId);
        return {
          id: exerciseId,
          session_id: sessionId,
          name_raw: ex.nameRaw,
          name_canonical: ex.nameCanonical,
          primary_muscle_group: ex.primaryMuscleGroup,
          muscle_contributions: ex.muscleContributions,
          updated_at: ex.updatedAt,
          created_at: ex.createdAt,
        };
      });

      const { error: exError, data: upsertedExercises } = await supabase
        .from('workout_exercises')
        .upsert(exercisesToUpsert, { onConflict: 'id' })
        .select('id');

      if (exError) {
        console.error('Exercise upsert error:', exError);
        throw exError;
      }

      // Verify exercises were upserted successfully
      if (!upsertedExercises || upsertedExercises.length === 0) {
        console.warn('No exercises were upserted, skipping sets');
        return;
      }

      // Create a map from the ID we sent to the database exercise ID
      // (in case Supabase generated a new ID or the ID was modified)
      const finalExerciseIdMap = new Map<string, string>();
      exercisesToUpsert.forEach((sentEx, index) => {
        const originalId = Array.from(exerciseIdMap.entries()).find(([_, convertedId]) => convertedId === sentEx.id)?.[0] || sentEx.id;
        const dbId = upsertedExercises[index]?.id || sentEx.id;
        finalExerciseIdMap.set(originalId, dbId);
      });
      
      // 3. Upsert Sets - verify exercises exist and use their database IDs
      for (const ex of session.exercises) {
        const originalId = ex.id;
        const exerciseId = finalExerciseIdMap.get(originalId) || exerciseIdMap.get(originalId) || originalId;
        
        // Verify the exercise exists and belongs to the user before inserting sets
        const { data: exerciseExists } = await supabase
          .from('workout_exercises')
          .select('id')
          .eq('id', exerciseId)
          .eq('session_id', sessionId)
          .single();

        if (!exerciseExists) {
          console.error(`Exercise ${exerciseId} not found or doesn't belong to session ${sessionId}, skipping sets`);
          continue;
        }
        
        if (ex.sets.length > 0) {
          const setsToUpsert = ex.sets.map(set => {
            this.assertValidId(set.id, 'Set id');
            const setId = set.id;
            return {
              id: setId,
              exercise_id: exerciseId,
              set_index: set.setIndex,
              reps: set.reps,
              weight_text: set.weightText,
              weight_kg: set.weightKg,
              is_bodyweight: set.isBodyweight,
              updated_at: set.updatedAt,
              created_at: set.createdAt,
            };
          });

          const { error: setError } = await supabase
            .from('workout_sets')
            .upsert(setsToUpsert, { onConflict: 'id' });

          if (setError) {
            console.error(`Set upsert error for exercise ${exerciseId}:`, setError);
            console.error('Failed sets:', setsToUpsert);
            throw setError;
          }
        }
      }

      // 4. Delete sets for exercises that were removed
      if (existingExercises && existingExercises.length > 0) {
        // Get all current exercise IDs (database UUIDs)
        const currentExerciseIds = new Set(
          Array.from(finalExerciseIdMap.values()).concat(
            Array.from(exerciseIdMap.values())
          )
        );
        
        // Filter to only valid UUIDs and find removed exercises
        const removedExerciseIds = existingExercises
          .map((ex: any) => ex.id)
          .filter((id: string) => {
            // Only include valid UUIDs
            if (!isValidUUID(id)) {
              console.warn(`Skipping non-UUID exercise ID in deletion: ${id}`);
              return false;
            }
            return !currentExerciseIds.has(id);
          });

        if (removedExerciseIds.length > 0) {
          // Delete sets for removed exercises (only valid UUIDs)
          const { error: deleteSetsError } = await supabase
            .from('workout_sets')
            .delete()
            .in('exercise_id', removedExerciseIds);

          if (deleteSetsError) {
            console.error('Error deleting sets for removed exercises:', deleteSetsError);
            // Don't throw - this is cleanup, not critical
          }

          // Delete the removed exercises themselves
          const { error: deleteExError } = await supabase
            .from('workout_exercises')
            .delete()
            .in('id', removedExerciseIds);

          if (deleteExError) {
            console.error('Error deleting removed exercises:', deleteExError);
            // Don't throw - exercises might already be deleted via CASCADE
          }
        }
      }
    } else {
      // No exercises in session - delete all exercises and their sets for this session
      if (existingExercises && existingExercises.length > 0) {
        const exerciseIds = existingExercises.map((ex: any) => ex.id);
        
        // Delete sets first (due to foreign key constraint)
        const { error: deleteSetsError } = await supabase
          .from('workout_sets')
          .delete()
          .in('exercise_id', exerciseIds);

        if (deleteSetsError) {
          console.error('Error deleting sets:', deleteSetsError);
        }

        // Then delete exercises
        const { error: deleteExError } = await supabase
          .from('workout_exercises')
          .delete()
          .eq('session_id', sessionId);

        if (deleteExError) {
          console.error('Error deleting exercises:', deleteExError);
        }
      }
    }
  }

  async deleteSession(id: string): Promise<void> {
    this.assertValidId(id, 'Session id');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');
    const { error } = await supabase
      .from('workout_sessions')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error deleting session:', error);
      throw error;
    }
  }

  private mapToDomain(dbSession: any): WorkoutSession {
    console.log('[CloudRepo] mapToDomain - performed_on:', dbSession.performed_on);
    console.log('[CloudRepo] mapToDomain - performed_on_utc_day:', dbSession.performed_on_utc_day);
    
    return {
      id: dbSession.id,
      userId: dbSession.user_id,
      performedOn: dbSession.performed_on_utc_day || dbSession.performed_on, // Use UTC day for consistency
      title: dbSession.title,
      notes: dbSession.notes,
      source: dbSession.source,
      updatedAt: dbSession.updated_at,
      createdAt: dbSession.created_at,
      exercises: (dbSession.workout_exercises || []).map((ex: any) => ({
        id: ex.id,
        sessionId: ex.session_id,
        nameRaw: ex.name_raw,
        nameCanonical: ex.name_canonical,
        primaryMuscleGroup: ex.primary_muscle_group,
        muscleContributions: ex.muscle_contributions,
        updatedAt: ex.updated_at,
        createdAt: ex.created_at,
        sets: (ex.workout_sets || []).map((s: any) => ({
          id: s.id,
          exerciseId: s.exercise_id,
          setIndex: s.set_index,
          reps: s.reps,
          weightText: s.weight_text,
          weightKg: s.weight_kg,
          isBodyweight: s.is_bodyweight,
          updatedAt: s.updated_at,
          createdAt: s.created_at,
        })).sort((a: WorkoutSet, b: WorkoutSet) => a.setIndex - b.setIndex),
      })),
    };
  }
}
