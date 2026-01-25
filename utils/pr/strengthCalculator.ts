export type TrainingGoal = 'strength' | 'hypertrophy' | 'conditioning';

const PERCENTAGES_BY_GOAL: Record<TrainingGoal, Array<{ reps: number; pct: number }>> = {
  strength: [
    { reps: 1, pct: 1.0 },
    { reps: 3, pct: 0.9 },
    { reps: 5, pct: 0.85 },
    { reps: 8, pct: 0.8 },
  ],
  hypertrophy: [
    { reps: 6, pct: 0.8 },
    { reps: 8, pct: 0.75 },
    { reps: 10, pct: 0.72 },
    { reps: 12, pct: 0.7 },
  ],
  conditioning: [
    { reps: 12, pct: 0.65 },
    { reps: 15, pct: 0.6 },
    { reps: 20, pct: 0.55 },
  ],
};

export function isLowerBodyExercise(exerciseName: string): boolean {
  const lowerBodyKeywords = [
    'squat',
    'deadlift',
    'leg press',
    'rdl',
    'lunge',
    'hip thrust',
    'leg extension',
    'leg curl',
    'calf raise',
  ];
  const normalized = exerciseName.toLowerCase();
  return lowerBodyKeywords.some((keyword) => normalized.includes(keyword));
}

export function getPercentageForReps(reps: number, goal: TrainingGoal): number {
  const table = PERCENTAGES_BY_GOAL[goal] || PERCENTAGES_BY_GOAL.hypertrophy;
  const closest = table.reduce((prev, curr) => {
    return Math.abs(curr.reps - reps) < Math.abs(prev.reps - reps) ? curr : prev;
  });
  return closest.pct;
}

export function calculateWeightForReps(params: {
  estimated1RM: number;
  targetReps: number;
  goal: TrainingGoal;
  roundTo?: number;
}): number {
  const roundTo = params.roundTo ?? 2.5;
  const percentage = getPercentageForReps(params.targetReps, params.goal);
  const rawWeight = params.estimated1RM * percentage;
  if (!Number.isFinite(rawWeight) || rawWeight <= 0) return 0;
  return Math.round(rawWeight / roundTo) * roundTo;
}

export function estimateWeightFromSimilarExercise(params: {
  similarExercise1RM: number;
  strengthRatio: number;
  targetReps: number;
  goal: TrainingGoal;
  roundTo?: number;
}): { estimated1RM: number; recommendedWeight: number } {
  const estimated1RM = params.similarExercise1RM * params.strengthRatio;
  const recommendedWeight = calculateWeightForReps({
    estimated1RM,
    targetReps: params.targetReps,
    goal: params.goal,
    roundTo: params.roundTo,
  });
  return { estimated1RM, recommendedWeight };
}
