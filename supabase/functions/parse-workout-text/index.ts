// supabase/functions/parse-workout-text/index.ts
// Supabase Edge Function for hosted AI parsing

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') || '';
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') || '';
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || '';

const RATE_LIMIT_WINDOW_SECONDS = 60;
const RATE_LIMIT_MAX_REQUESTS = 10;

interface RequestBody {
  provider: 'openai' | 'anthropic' | 'gemini';
  model: string;
  text: string;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify JWT and get user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check rate limit
    const { data: rateLimitData, error: rateLimitError } = await supabase.rpc(
      'rate_limit_ai_request',
      {
        window_seconds: RATE_LIMIT_WINDOW_SECONDS,
        max_requests: RATE_LIMIT_MAX_REQUESTS,
      }
    );

    if (rateLimitError) {
      console.error('Rate limit check error:', rateLimitError);
      return new Response(
        JSON.stringify({ error: 'Rate limit check failed' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!rateLimitData || rateLimitData.length === 0 || !rateLimitData[0].allowed) {
      const resetAt = rateLimitData?.[0]?.reset_at;
      return new Response(
        JSON.stringify({
          error: 'Rate limit exceeded',
          reset_at: resetAt,
        }),
        {
          status: 429,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Parse request body
    const body: RequestBody = await req.json();
    const { provider, model, text } = body;

    if (!provider || !model || !text) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: provider, model, text' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Call appropriate provider
    let rawText: string;
    const systemPrompt = `You are a plain-English → JSON parser for workout logs.

Your job is to convert user-provided exercise descriptions into structured JSON objects with HIGH accuracy and HIGH consistency.

You are not an analyst, coach, or recommender.
You do not estimate muscle groups.
You do not infer biomechanics.
You only parse and normalize input.

────────────────────────────────────────────────────────
STRICT OUTPUT RULES
────────────────────────────────────────────────────────
- Output MUST be valid JSON
- Output MUST be a JSON array
- Each array item represents ONE exercise
- No extra text, no markdown, no commentary

────────────────────────────────────────────────────────
OUTPUT SCHEMA (MUST MATCH)
────────────────────────────────────────────────────────
{
  "id": "string",
  "date": "YYYY-MM-DD | null",
  "exercise": "string",
  "sets": integer,
  "reps": [integer] | null,
  "weights": [string] | null,
  "primaryMuscleGroup": null,
  "muscleContributions": null
}

IMPORTANT:
- Always set primaryMuscleGroup = null
- Always set muscleContributions = null
(Downstream analytics will derive these deterministically from templates.)

────────────────────────────────────────────────────────
ID GENERATION
────────────────────────────────────────────────────────
Each exercise entry must have a unique ID using:
"{YYYY-MM-DD}-{exerciseIndex}"
- YYYY-MM-DD is the parsed date, or "null" if unavailable
- exerciseIndex starts at 1 and increments per exercise on the same date

────────────────────────────────────────────────────────
DATE HANDLING
────────────────────────────────────────────────────────
Parse dates from formats including:
"December 3", "Dec 3rd", "12/3/24", "2024-12-03"
If no date is present: "date": null
DO NOT generate a date.

────────────────────────────────────────────────────────
MISSING VALUES
────────────────────────────────────────────────────────
Scenario            Sets         Reps         Weights
Reps missing        Use provided null         null
Sets missing        Default=1    Use provided null
Both missing        Default=1    null         null

Bodyweight rule:
If the user explicitly indicates bodyweight (e.g. "pullups BW", "dips bodyweight"):
- weights should be ["bodyweight", ...] repeated for each set.

────────────────────────────────────────────────────────
WEIGHTS RULES
────────────────────────────────────────────────────────
- weights must be strings (examples: "135", "45", "bodyweight", "+45", "-30")
- If weights are listed per dumbbell (e.g. "DB bench 40s"), keep the per-dumbbell number as-is
  (Do NOT double). The app can decide how to interpret; you only record what the user said.
- Ensure reps.length === sets and weights.length === sets when reps/weights are present.

────────────────────────────────────────────────────────
EXERCISE NAME NORMALIZATION (CRITICAL)
────────────────────────────────────────────────────────
Goal: output a stable, canonical Title Case exercise name so template matching works.

Rules:
- Normalize to Title Case.
- Remove extra punctuation and fluff (e.g. "!!!", "felt heavy", etc.)
- Prefer these canonical names when clearly applicable:

CANONICAL NAMES (use exact spelling):
- Squat
- Front Squat
- Deadlift
- Romanian Deadlift
- Bench Press
- Incline Bench Press
- Overhead Press
- Pull Up
- Chin Up
- Lat Pulldown
- Barbell Row
- Dumbbell Row
- Leg Press
- Leg Extension
- Leg Curl
- Calf Raise
- Bicep Curl
- Tricep Pushdown
- Lateral Raise
- Pec Deck Fly
- Cable Fly

If the user specifies a machine or variation that changes the movement meaningfully, include it:
- "Smith Machine Squat"
- "Hack Squat"
- "Goblet Squat"
But do NOT invent machine names. Only include what the user said.

If uncertain, preserve the user’s wording in clean Title Case (do not guess a different exercise).

────────────────────────────────────────────────────────
SHORTHAND PARSING
────────────────────────────────────────────────────────
- "4x12 @ 135" => sets=4, reps=[12,12,12,12], weights=["135","135","135","135"]
- Convert number words to digits when obvious ("one thirty five" => "135")

────────────────────────────────────────────────────────
FINAL NOTE
────────────────────────────────────────────────────────
Return ONLY the JSON array. No other output.`;

    if (provider === 'openai') {
      if (!OPENAI_API_KEY) {
        return new Response(
          JSON.stringify({ error: 'OpenAI API key not configured' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'system',
              content: systemPrompt,
            },
            {
              role: 'user',
              content: text,
            },
          ],
          temperature: 0.3,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return new Response(
          JSON.stringify({ error: `OpenAI API error: ${errorData.error?.message || response.statusText}` }),
          { status: response.status, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const data = await response.json();
      rawText = data.choices?.[0]?.message?.content || '';
    } else if (provider === 'anthropic') {
      if (!ANTHROPIC_API_KEY) {
        return new Response(
          JSON.stringify({ error: 'Anthropic API key not configured' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: 4096,
          system: systemPrompt,
          messages: [
            {
              role: 'user',
              content: text,
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return new Response(
          JSON.stringify({ error: `Anthropic API error: ${errorData.error?.message || response.statusText}` }),
          { status: response.status, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const data = await response.json();
      rawText = data.content?.[0]?.text || '';
    } else if (provider === 'gemini') {
      if (!GEMINI_API_KEY) {
        return new Response(
          JSON.stringify({ error: 'Gemini API key not configured' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `${systemPrompt}\n\nINPUT:\n${text}`,
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.3,
              responseMimeType: 'application/json',
            },
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return new Response(
          JSON.stringify({ error: `Gemini API error: ${errorData.error?.message || response.statusText}` }),
          { status: response.status, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const data = await response.json();
      rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } else {
      return new Response(
        JSON.stringify({ error: `Unsupported provider: ${provider}` }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!rawText) {
      return new Response(
        JSON.stringify({ error: 'Empty response from AI provider' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        rawText,
        remaining: rateLimitData[0].remaining,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (error) {
    console.error('Edge function error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
});

