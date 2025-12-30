// @ts-nocheck
// Supabase Edge Function for hosted AI parsing

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') || '';
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') || '';
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || '';

const RATE_LIMIT_WINDOW_SECONDS = 60;
const RATE_LIMIT_MAX_REQUESTS = 10;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  provider: 'openai' | 'anthropic' | 'gemini';
  model: string;
  text: string;
  task?:
    | 'parse_workout'
    | 'ask_intent'
    | 'plan_intent'
    | 'ask_explain'
    | 'plan_explain'
    | 'conversational_response';
  systemPrompt?: string;
}

function jsonResponse(body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
  });
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.warn('Missing Authorization header');
      return jsonResponse(
        {
          error: 'Missing authorization header',
          diag: { hasAuthorizationHeader: false },
        },
        401
      );
    }

    // Normalize JWT (allow either "Bearer <jwt>" or "<jwt>")
    const jwt = (authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7) : authHeader).trim();

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('Missing Supabase env', {
        hasSupabaseUrl: Boolean(supabaseUrl),
        hasSupabaseAnonKey: Boolean(supabaseAnonKey),
      });
      return jsonResponse({ error: 'Supabase env not configured in Edge Function' }, 500);
    }
    // Use a non-authenticated client for user lookup (pass raw JWT explicitly)
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Verify JWT and get user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(jwt);

    if (authError || !user) {
      console.warn('Unauthorized: supabase.auth.getUser() failed', {
        authError: authError ? { message: authError.message, name: (authError as any).name } : null,
        hasUser: Boolean(user),
      });
      return jsonResponse(
        {
          error: 'Unauthorized',
          details: authError?.message ?? null,
          diag: {
            hasAuthorizationHeader: true,
            authorizationStartsWithBearer: authHeader.toLowerCase().startsWith('bearer '),
            authorizationLength: authHeader.length,
          },
        },
        401
      );
    }

    // Authenticated client for DB calls (RLS, RPC)
    const authedSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });

    // Check rate limit (optional: if RPC isn't installed yet, skip gracefully)
    let remaining: number | null = null;
    try {
      const { data: rateLimitData, error: rateLimitError } = await authedSupabase.rpc(
        'rate_limit_ai_request',
        {
          window_seconds: RATE_LIMIT_WINDOW_SECONDS,
          max_requests: RATE_LIMIT_MAX_REQUESTS,
        }
      );

      if (rateLimitError) {
        const code = (rateLimitError as any)?.code;
        // PGRST202 = RPC not found in schema cache
        if (code === 'PGRST202') {
          console.warn('Rate limit RPC not found; skipping rate limiting');
        } else {
          console.error('Rate limit check error:', rateLimitError);
          return jsonResponse({ error: 'Rate limit check failed', details: rateLimitError.message }, 500);
        }
      } else if (rateLimitData?.length && rateLimitData[0]?.allowed === false) {
        const resetAt = rateLimitData?.[0]?.reset_at;
        return jsonResponse(
          {
            error: 'Rate limit exceeded',
            reset_at: resetAt,
          },
          429
        );
      } else if (rateLimitData?.length) {
        const r = rateLimitData?.[0]?.remaining;
        remaining = typeof r === 'number' ? r : null;
      }
    } catch (e) {
      console.error('Rate limit check unexpected error:', e);
      return jsonResponse({ error: 'Rate limit check failed' }, 500);
    }

    // Parse request body
    const body: RequestBody = await req.json();
    const { provider, model, text, task = 'parse_workout', systemPrompt: customSystemPrompt } = body;

    if (!provider || !model || !text) {
      return jsonResponse({ error: 'Missing required fields: provider, model, text' }, 400);
    }

    // Select system prompt based on task
    let systemPrompt: string;
    if (customSystemPrompt) {
      systemPrompt = customSystemPrompt;
    } else if (task === 'ask_intent') {
      systemPrompt = `You are an intent classifier for workout queries. Your job is to convert user questions into structured JSON intents.

Output MUST be valid JSON only. No markdown, no commentary, no extra text.

Supported intent types:
1. last_exercise_date: "When was the last time I did X?"
   Schema: { "type": "last_exercise_date", "exercise": "string" }

2. last_exercise_details: "What did I do for X last time?" or "How much did I deadlift last time?"
   Schema: { "type": "last_exercise_details", "exercise": "string" }

3. best_exercise: "What's my best X?" or "What's my PR for X?"
   Schema: { "type": "best_exercise", "exercise": "string", "metric": "weight" | "e1rm" | "volume" }
   - Use "weight" for max weight lifted
   - Use "e1rm" for estimated one-rep max
   - Use "volume" for total volume (sets × reps × weight)

4. volume_summary: "How many quad sets last week?" or "What was my weekly volume for bench?"
   Schema: { "type": "volume_summary", "muscleGroup"?: "string", "exercise"?: "string", "range": "week" | "month" | "custom", "start"?: "YYYY-MM-DD", "end"?: "YYYY-MM-DD" }
   - If range is "week", use last 7 days
   - If range is "month", use last 30 days
   - If range is "custom", include start and end dates

5. last_session_summary: "What did I do last time?" (no specific exercise)
   Schema: { "type": "last_session_summary" }

Rules:
- Extract exercise names as written by the user (normalize capitalization but preserve the name)
- If the query doesn't match any intent, use the closest match
- Return ONLY the JSON object, no other text`;
    } else if (task === 'plan_intent') {
      systemPrompt = `You are an intent classifier for workout planning requests. Your job is to convert user requests into structured JSON intents.

Output MUST be valid JSON only. No markdown, no commentary, no extra text.

Schema:
{
  "type": "workout_plan",
  "goal"?: "strength" | "hypertrophy" | "conditioning",
  "durationMinutes"?: number,
  "focus"?: "upper" | "lower" | "push" | "pull" | "legs" | "full"
}

Rules:
- Extract goal if mentioned (strength/hypertrophy/conditioning)
- Extract duration if mentioned (e.g., "45 minute workout" → durationMinutes: 45)
- Extract focus if mentioned (upper/lower/push/pull/legs/full body)
- All fields are optional
- Return ONLY the JSON object, no other text`;
    } else if (task === 'ask_explain' || task === 'plan_explain') {
      systemPrompt =
        task === 'ask_explain'
          ? `You are a helpful assistant that explains workout data in a friendly, conversational way.

Given a structured data result, format it into a natural language answer.

Rules:
- Be concise and clear
- Use the data provided (don't invent facts)
- If no data is found, explain that politely
- Keep it under 3 sentences unless the data is complex
- Return ONLY the explanation text, no markdown formatting`
          : `You are a helpful assistant that explains workout plans in a friendly, motivational way.

Given a structured workout plan, format it into a natural language explanation.

Rules:
- Be concise and motivational
- Explain the rationale if provided
- Format exercises clearly
- Keep it conversational
- Return ONLY the explanation text, no markdown formatting`;
    } else {
      // Default: parse_workout
      systemPrompt = `You are a plain-English → JSON parser for workout logs.

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
    }

    let rawText = '';

    if (provider === 'openai') {
      if (!OPENAI_API_KEY) {
        return jsonResponse({ error: 'OpenAI API key not configured' }, 500);
      }

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: text },
          ],
          temperature: 0.3,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return jsonResponse(
          { error: `OpenAI API error: ${errorData.error?.message || response.statusText}` },
          response.status
        );
      }

      const data = await response.json();
      rawText = data.choices?.[0]?.message?.content || '';
    } else if (provider === 'anthropic') {
      if (!ANTHROPIC_API_KEY) {
        return jsonResponse({ error: 'Anthropic API key not configured' }, 500);
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
          messages: [{ role: 'user', content: text }],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return jsonResponse(
          { error: `Anthropic API error: ${errorData.error?.message || response.statusText}` },
          response.status
        );
      }

      const data = await response.json();
      rawText = data.content?.[0]?.text || '';
    } else if (provider === 'gemini') {
      if (!GEMINI_API_KEY) {
        return jsonResponse({ error: 'Gemini API key not configured' }, 500);
      }

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: `${systemPrompt}\n\nINPUT:\n${text}` }],
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
        return jsonResponse(
          { error: `Gemini API error: ${errorData.error?.message || response.statusText}` },
          response.status
        );
      }

      const data = await response.json();
      rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } else {
      return jsonResponse({ error: `Unsupported provider: ${provider}` }, 400);
    }

    if (!rawText) {
      return jsonResponse({ error: 'Empty response from AI provider' }, 500);
    }

    return jsonResponse({
      rawText,
      remaining,
    });
  } catch (error: unknown) {
    console.error('Edge function error:', error);
    return jsonResponse(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});