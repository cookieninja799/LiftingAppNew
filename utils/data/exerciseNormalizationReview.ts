import AsyncStorage from '@react-native-async-storage/async-storage';

export type NormalizationSource = 'rule' | 'ai';

export type NormalizationReviewItem = {
  id: string;
  sessionId: string;
  exerciseId: string;
  nameRaw: string;
  suggestedCanonical: string;
  confidence: 'high' | 'low';
  source: NormalizationSource;
  createdAt: string;
};

const REVIEW_ITEMS_KEY = 'exerciseNormalizationReviewItems';

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export async function loadNormalizationReviewItems(): Promise<NormalizationReviewItem[]> {
  try {
    const stored = await AsyncStorage.getItem(REVIEW_ITEMS_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Failed to load normalization review items:', error);
    return [];
  }
}

export async function saveNormalizationReviewItems(items: NormalizationReviewItem[]): Promise<void> {
  try {
    await AsyncStorage.setItem(REVIEW_ITEMS_KEY, JSON.stringify(items));
  } catch (error) {
    console.error('Failed to save normalization review items:', error);
    throw error;
  }
}

export async function addNormalizationReviewItems(
  items: Omit<NormalizationReviewItem, 'id' | 'createdAt'>[]
): Promise<NormalizationReviewItem[]> {
  const existing = await loadNormalizationReviewItems();
  const now = new Date().toISOString();
  const next = [
    ...existing,
    ...items.map((item) => ({
      ...item,
      id: generateId(),
      createdAt: now,
    })),
  ];
  await saveNormalizationReviewItems(next);
  return next;
}

export async function clearNormalizationReviewItems(): Promise<void> {
  try {
    await AsyncStorage.removeItem(REVIEW_ITEMS_KEY);
  } catch (error) {
    console.error('Failed to clear normalization review items:', error);
    throw error;
  }
}
