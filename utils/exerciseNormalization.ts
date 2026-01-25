export type NormalizationConfidence = 'high' | 'low';

export interface NormalizationResult {
  canonical: string;
  confidence: NormalizationConfidence;
  transformations: string[];
}

const ABBREVIATIONS: Record<string, string> = {
  db: 'dumbbell',
  bb: 'barbell',
  kb: 'kettlebell',
  bw: 'bodyweight',
  smith: 'smith',
};

const FILLER_WORDS = new Set(['the', 'a', 'an', 'and', 'with']);
const DIRECTION_WORDS = new Set(['low', 'high', 'incline', 'decline', 'flat']);
const EQUIPMENT_WORDS = new Set([
  'cable',
  'dumbbell',
  'barbell',
  'kettlebell',
  'machine',
  'smith',
  'bodyweight',
  'band',
]);

const IRREGULAR_PLURALS: Record<string, string> = {
  flies: 'fly',
  rows: 'row',
  presses: 'press',
  raises: 'raise',
  ups: 'up',
};

function normalizeToken(token: string): string {
  if (!token) return '';
  if (IRREGULAR_PLURALS[token]) return IRREGULAR_PLURALS[token];
  if (token.length > 3 && token.endsWith('s') && !token.endsWith('ss')) {
    return token.slice(0, -1);
  }
  return token;
}

function reorderTokens(tokens: string[], transformations: string[]): string[] {
  const equipment: string[] = [];
  const direction: string[] = [];
  const rest: string[] = [];

  tokens.forEach((token) => {
    if (EQUIPMENT_WORDS.has(token)) {
      equipment.push(token);
    } else if (DIRECTION_WORDS.has(token)) {
      direction.push(token);
    } else {
      rest.push(token);
    }
  });

  const reordered = [...equipment, ...rest, ...direction];
  if (reordered.join(' ') !== tokens.join(' ')) {
    transformations.push('reordered tokens');
  }
  return reordered;
}

function calculateConfidence(canonical: string, transformations: string[]): NormalizationConfidence {
  if (!canonical || canonical.length < 3) return 'low';
  if (transformations.length > 2) return 'low';
  return 'high';
}

export function normalizeExerciseName(nameRaw: string): NormalizationResult {
  const transformations: string[] = [];

  let normalized = nameRaw || '';
  if (!normalized) {
    return { canonical: '', confidence: 'low', transformations: ['empty input'] };
  }

  const lower = normalized.toLowerCase().trim();
  if (lower !== normalized) transformations.push('lowercased/trimmed');
  normalized = lower;

  const normalizedPunctuation = normalized
    .replace(/[–—-]/g, ' ')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (normalizedPunctuation !== normalized) transformations.push('normalized punctuation');
  normalized = normalizedPunctuation;

  normalized = normalized.replace(/\blow to high\b/g, 'low high');
  normalized = normalized.replace(/\bhigh to low\b/g, 'high low');

  let tokens = normalized
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length > 0);

  const expandedTokens = tokens.map((token) => ABBREVIATIONS[token] || token);
  if (expandedTokens.join(' ') !== tokens.join(' ')) {
    transformations.push('expanded abbreviations');
  }
  tokens = expandedTokens;

  const filteredTokens = tokens.filter((token) => !FILLER_WORDS.has(token));
  if (filteredTokens.length !== tokens.length) transformations.push('removed filler words');
  tokens = filteredTokens;

  tokens = tokens.map(normalizeToken);

  const reordered = reorderTokens(tokens, transformations);
  tokens = reordered;

  const canonical = tokens.join(' ').trim();
  const confidence = calculateConfidence(canonical, transformations);

  return {
    canonical,
    confidence,
    transformations,
  };
}

export function getSimilarExercises(canonical: string, allExercises: string[]): string[] {
  const normalizedCanonical = normalizeExerciseName(canonical).canonical;
  if (!normalizedCanonical) return [];
  return allExercises.filter((exercise) => {
    const normalized = normalizeExerciseName(exercise).canonical;
    return normalized === normalizedCanonical;
  });
}
