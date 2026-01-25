import { WorkoutSession, WorkoutExercise } from '@/utils/workoutSessions';
import { getDefaultMuscleContributions } from '@/utils/analytics/muscleContributions';
import { workoutRepository } from '@/data/WorkoutRepositoryManager';

export interface BatchTaggingResult {
  tagged: number;
  skipped: number;
  updatedSessions: number;
  exercisesByMuscleGroup: Record<string, number>;
}

/**
 * Tags existing workout exercises with muscle groups and contributions.
 * Only tags exercises that don't already have muscleContributions or primaryMuscleGroup.
 * 
 * @param options - Configuration options
 * @returns Result statistics
 */
export async function batchTagMuscleGroups(options: {
  sessions?: WorkoutSession[];
  dryRun?: boolean;
  forceUpdate?: boolean; // If true, updates even exercises that already have muscle data
} = {}): Promise<BatchTaggingResult> {
  const {
    sessions: providedSessions,
    dryRun = false,
    forceUpdate = false,
  } = options;

  const sessions = providedSessions ?? (await workoutRepository.listSessions());
  
  let tagged = 0;
  let skipped = 0;
  let updatedSessions = 0;
  const exercisesByMuscleGroup: Record<string, number> = {};

  for (const session of sessions) {
    let sessionUpdated = false;

    for (const exercise of session.exercises) {
      // Skip if exercise already has muscle data (unless forceUpdate is true)
      if (!forceUpdate && exercise.muscleContributions && exercise.muscleContributions.length > 0) {
        skipped += 1;
        continue;
      }

      // Get muscle contributions from templates
      const contributions = getDefaultMuscleContributions(
        exercise.nameRaw,
        exercise.primaryMuscleGroup
      );

      if (contributions && contributions.length > 0) {
        // Set muscle contributions
        exercise.muscleContributions = contributions;
        
        // Set primary muscle group from first contribution (if not already set)
        if (!exercise.primaryMuscleGroup) {
          exercise.primaryMuscleGroup = contributions[0].muscleGroup;
        }

        // Track statistics
        tagged += 1;
        sessionUpdated = true;

        // Count exercises by primary muscle group (first contribution)
        const primaryGroup = contributions[0].muscleGroup;
        exercisesByMuscleGroup[primaryGroup] = 
          (exercisesByMuscleGroup[primaryGroup] || 0) + 1;
      } else {
        skipped += 1;
      }
    }

    if (sessionUpdated) {
      updatedSessions += 1;
      if (!dryRun) {
        await workoutRepository.upsertSession(session);
      }
    }
  }

  return {
    tagged,
    skipped,
    updatedSessions,
    exercisesByMuscleGroup,
  };
}
