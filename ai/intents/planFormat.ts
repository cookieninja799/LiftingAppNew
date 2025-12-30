// ai/intents/planFormat.ts
// Deterministic formatting for Plan results (no LLM)

import { WorkoutPlan, ExercisePlan } from './planExecutor';

export interface FormattedPlanExercise {
  name: string;
  prescription: string; // e.g., "3 sets × 8–12 reps"
  weight?: string; // e.g., "185 lbs (~72% 1RM)"
  intensity: string; // e.g., "RPE 7–8"
  notes?: string;
  confidence?: 'high' | 'medium' | 'low';
}

export interface FormattedPlan {
  title: string;
  summary: string;
  exercises: FormattedPlanExercise[];
  rationale: string[];
  hasPersonalizedWeights: boolean;
}

/**
 * Formats a WorkoutPlan into a user-friendly display format
 */
export function formatPlanResult(plan: WorkoutPlan): FormattedPlan {
  const exercises = plan.exercises.map(ex => formatExercise(ex));
  
  // Build summary
  const exerciseCount = exercises.length;
  const hasWeights = plan.hasPersonalizedWeights || exercises.some(e => e.weight);
  
  let summary = `${exerciseCount} exercises`;
  if (hasWeights) {
    summary += ' with personalized weight recommendations';
  }
  if (plan.isGeneric) {
    summary += ' (generic template)';
  }
  
  return {
    title: plan.title,
    summary,
    exercises,
    rationale: plan.rationale,
    hasPersonalizedWeights: hasWeights,
  };
}

/**
 * Formats a single exercise with its prescription
 */
function formatExercise(exercise: ExercisePlan): FormattedPlanExercise {
  const prescription = `${exercise.sets} sets × ${exercise.reps} reps`;
  
  let weight: string | undefined;
  let confidence: 'high' | 'medium' | 'low' | undefined;
  
  if (exercise.recommendedWeight) {
    const rw = exercise.recommendedWeight;
    weight = `${rw.value} ${rw.unit}`;
    
    if (rw.percentageOfMax) {
      weight += ` (~${rw.percentageOfMax}% 1RM)`;
    }
    
    confidence = rw.confidence;
    
    if (rw.confidence === 'low') {
      weight += ' ⚠️';
    }
  }
  
  return {
    name: exercise.exercise,
    prescription,
    weight,
    intensity: exercise.intensity || 'RPE 7–8',
    notes: exercise.notes,
    confidence,
  };
}

/**
 * Formats plan as a simple text string (for sharing or display)
 */
export function formatPlanAsText(plan: WorkoutPlan): string {
  const lines: string[] = [];
  
  lines.push(`📋 ${plan.title}`);
  lines.push('');
  
  plan.exercises.forEach((ex, i) => {
    let line = `${i + 1}. ${ex.exercise}: ${ex.sets} × ${ex.reps}`;
    
    if (ex.recommendedWeight) {
      line += ` @ ${ex.recommendedWeight.value} ${ex.recommendedWeight.unit}`;
    }
    
    if (ex.intensity) {
      line += ` (${ex.intensity})`;
    }
    
    lines.push(line);
    
    if (ex.notes) {
      lines.push(`   ↳ ${ex.notes}`);
    }
  });
  
  lines.push('');
  lines.push('---');
  plan.rationale.forEach(r => lines.push(`• ${r}`));
  
  return lines.join('\n');
}

/**
 * Creates a data card format for UI display
 */
export function formatPlanAsCard(plan: WorkoutPlan): {
  title: string;
  exercises: Array<{
    name: string;
    details: string;
    weight?: string;
    notes?: string;
    confidence?: 'high' | 'medium' | 'low';
  }>;
  footer: string;
} {
  return {
    title: plan.title,
    exercises: plan.exercises.map(ex => ({
      name: ex.exercise,
      details: `${ex.sets} × ${ex.reps} @ ${ex.intensity}`,
      weight: ex.recommendedWeight 
        ? `${ex.recommendedWeight.value} ${ex.recommendedWeight.unit}`
        : undefined,
      notes: ex.notes,
      confidence: ex.recommendedWeight?.confidence,
    })),
    footer: plan.rationale.join(' '),
  };
}

