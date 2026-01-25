import { WorkoutSession } from '@/utils/workoutSessions';
import { normalizeExerciseName, getSimilarExercises } from '@/utils/exerciseNormalization';
import { normalizeExerciseNameWithAI } from '@/ai/normalizeExerciseName';
import { workoutRepository } from '@/data/WorkoutRepositoryManager';
import { addNormalizationReviewItems } from '@/utils/data/exerciseNormalizationReview';

export interface BatchNormalizationResult {
  normalized: number;
  needsReview: number;
  updatedSessions: number;
}

export async function batchNormalizeExercises(options: {
  sessions?: WorkoutSession[];
  useAIFallback?: boolean;
  supabaseClient?: any;
  dryRun?: boolean;
} = {}): Promise<BatchNormalizationResult> {
  const {
    sessions: providedSessions,
    useAIFallback = true,
    supabaseClient,
    dryRun = false,
  } = options;

  const sessions = providedSessions ?? (await workoutRepository.listSessions());
  const allExerciseNames = sessions.flatMap((session) =>
    (session.exercises || []).map((ex) => ex.nameRaw).filter(Boolean)
  );

  let normalized = 0;
  let needsReview = 0;
  let updatedSessions = 0;

  for (const session of sessions) {
    let sessionUpdated = false;
    const reviewItems: Parameters<typeof addNormalizationReviewItems>[0] = [];

    for (const exercise of session.exercises) {
      if (exercise.nameCanonical && exercise.nameCanonical.trim().length > 0) continue;

      const normalizedResult = normalizeExerciseName(exercise.nameRaw || '');
      let canonical = normalizedResult.canonical;
      let confidence = normalizedResult.confidence;
      let source: 'rule' | 'ai' = 'rule';

      if (confidence === 'low' && useAIFallback) {
        const similar = getSimilarExercises(exercise.nameRaw || '', allExerciseNames).slice(0, 5);
        const aiResult = await normalizeExerciseNameWithAI(exercise.nameRaw || '', {
          context: similar,
          supabaseClient,
        });
        if (aiResult.success && aiResult.canonical) {
          canonical = aiResult.canonical;
          source = 'ai';
        }
      }

      if (canonical) {
        exercise.nameCanonical = canonical;
        sessionUpdated = true;
        normalized += 1;
      }

      if (confidence === 'low') {
        needsReview += 1;
        reviewItems.push({
          sessionId: session.id,
          exerciseId: exercise.id,
          nameRaw: exercise.nameRaw,
          suggestedCanonical: canonical || exercise.nameRaw,
          confidence,
          source,
        });
      }
    }

    if (reviewItems.length > 0) {
      await addNormalizationReviewItems(reviewItems);
    }

    if (sessionUpdated) {
      updatedSessions += 1;
      if (!dryRun) {
        await workoutRepository.upsertSession(session);
      }
    }
  }

  return { normalized, needsReview, updatedSessions };
}
