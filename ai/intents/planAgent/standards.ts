export type StrengthLevel = 'active' | 'beginner' | 'intermediate' | 'advanced' | 'elite';
export type Sex = 'male' | 'female';
export type AgeBand = '15-19' | '20-29' | '30-39' | '40-49' | '50-59' | '60-69' | '70-79' | '80-89';
export type LiftName = 'squat' | 'bench' | 'deadlift' | 'press';

export interface StrengthStandardEntry {
  sex: Sex;
  ageBand: AgeBand;
  bodyweightKg: number;
  lift: LiftName;
  levels: Record<StrengthLevel, number>;
}

export const KILGORE_STANDARDS: StrengthStandardEntry[] = [
  {
    sex: 'male',
    ageBand: '20-29',
    bodyweightKg: 75,
    lift: 'squat',
    levels: { active: 90, beginner: 120, intermediate: 150, advanced: 185, elite: 215 },
  },
  {
    sex: 'male',
    ageBand: '20-29',
    bodyweightKg: 75,
    lift: 'bench',
    levels: { active: 65, beginner: 85, intermediate: 110, advanced: 135, elite: 155 },
  },
  {
    sex: 'male',
    ageBand: '20-29',
    bodyweightKg: 75,
    lift: 'deadlift',
    levels: { active: 110, beginner: 145, intermediate: 180, advanced: 215, elite: 240 },
  },
  {
    sex: 'male',
    ageBand: '20-29',
    bodyweightKg: 75,
    lift: 'press',
    levels: { active: 40, beginner: 52, intermediate: 67, advanced: 82, elite: 95 },
  },
  {
    sex: 'female',
    ageBand: '20-29',
    bodyweightKg: 60,
    lift: 'squat',
    levels: { active: 55, beginner: 72, intermediate: 90, advanced: 110, elite: 125 },
  },
  {
    sex: 'female',
    ageBand: '20-29',
    bodyweightKg: 60,
    lift: 'bench',
    levels: { active: 32, beginner: 42, intermediate: 52, advanced: 62, elite: 72 },
  },
  {
    sex: 'female',
    ageBand: '20-29',
    bodyweightKg: 60,
    lift: 'deadlift',
    levels: { active: 75, beginner: 95, intermediate: 115, advanced: 135, elite: 150 },
  },
  {
    sex: 'female',
    ageBand: '20-29',
    bodyweightKg: 60,
    lift: 'press',
    levels: { active: 22, beginner: 28, intermediate: 34, advanced: 40, elite: 46 },
  },
];

export function getNearestStandard(params: {
  sex: Sex;
  ageBand: AgeBand;
  bodyweightKg: number;
  lift: LiftName;
}): StrengthStandardEntry | null {
  const matches = KILGORE_STANDARDS.filter(
    (entry) =>
      entry.sex === params.sex &&
      entry.ageBand === params.ageBand &&
      entry.lift === params.lift
  );
  if (matches.length === 0) return null;

  let closest = matches[0];
  let closestDiff = Math.abs(matches[0].bodyweightKg - params.bodyweightKg);
  for (const entry of matches.slice(1)) {
    const diff = Math.abs(entry.bodyweightKg - params.bodyweightKg);
    if (diff < closestDiff) {
      closest = entry;
      closestDiff = diff;
    }
  }

  return closest;
}

export function classifyStrength(params: {
  estimated1RM: number;
  standard: StrengthStandardEntry;
}): { classification: StrengthLevel; percentOfElite: number } {
  const { standard, estimated1RM } = params;
  const levels = standard.levels;
  const percentOfElite = levels.elite > 0 ? estimated1RM / levels.elite : 0;

  const ordered: StrengthLevel[] = ['active', 'beginner', 'intermediate', 'advanced', 'elite'];
  let classification: StrengthLevel = 'active';
  for (const level of ordered) {
    if (estimated1RM >= levels[level]) {
      classification = level;
    }
  }

  return { classification, percentOfElite };
}
