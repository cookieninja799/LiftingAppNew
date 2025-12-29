// ai/extractJson.ts
// Deterministic JSON extraction from AI responses

export type ExtractJsonResult =
  | { success: true; jsonText: string }
  | { success: false; error: 'no_json_found' | 'invalid_json' };

/**
 * Extracts JSON from AI response text using deterministic rules:
 * 1. If full response is valid JSON → use it
 * 2. Else strip code fences and retry JSON parse
 * 3. Else attempt to find first JSON object/array via bracket/brace matching
 * 4. Otherwise fail with no_json_found
 */
export function extractJson(text: string): ExtractJsonResult {
  if (!text || typeof text !== 'string') {
    return { success: false, error: 'no_json_found' };
  }

  const trimmed = text.trim();

  // Step 1: Try parsing the full response as JSON
  try {
    JSON.parse(trimmed);
    return { success: true, jsonText: trimmed };
  } catch {
    // Continue to next step
  }

  // Step 2: Strip code fences (```json ... ``` or ``` ... ```)
  const withoutFences = trimmed
    .replace(/^```(?:json)?\s*\n?/gm, '')
    .replace(/\n?```$/gm, '')
    .trim();

  if (withoutFences !== trimmed) {
    try {
      JSON.parse(withoutFences);
      return { success: true, jsonText: withoutFences };
    } catch {
      // Continue to next step
    }
  }

  // Step 3: Find first JSON object/array via bracket/brace matching
  const jsonMatch = findFirstJsonObject(trimmed);
  if (jsonMatch) {
    try {
      JSON.parse(jsonMatch);
      return { success: true, jsonText: jsonMatch };
    } catch {
      // Invalid JSON even after extraction
      return { success: false, error: 'invalid_json' };
    }
  }

  const isJsonLike = trimmed.startsWith('{') || trimmed.startsWith('[');
  return { success: false, error: isJsonLike ? 'invalid_json' : 'no_json_found' };
}

/**
 * Finds the first JSON object or array in text by matching braces/brackets
 */
function findFirstJsonObject(text: string): string | null {
  let startIdx = -1;
  let braceDepth = 0;
  let bracketDepth = 0;
  let inString = false;
  let escapeNext = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (char === '\\') {
      escapeNext = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === '{') {
      if (startIdx === -1) {
        startIdx = i;
      }
      braceDepth++;
    } else if (char === '}') {
      braceDepth--;
      if (braceDepth === 0 && bracketDepth === 0 && startIdx !== -1) {
        return text.substring(startIdx, i + 1);
      }
    } else if (char === '[') {
      if (startIdx === -1) {
        startIdx = i;
      }
      bracketDepth++;
    } else if (char === ']') {
      bracketDepth--;
      if (bracketDepth === 0 && braceDepth === 0 && startIdx !== -1) {
        return text.substring(startIdx, i + 1);
      }
    }
  }

  return null;
}

