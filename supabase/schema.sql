-- Supabase Schema for LiftingAppNew

-- 1. Profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Workout Sessions table
CREATE TABLE IF NOT EXISTS public.workout_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  performed_on TIMESTAMP WITH TIME ZONE NOT NULL,
  performed_on_utc_day DATE GENERATED ALWAYS AS ((performed_on AT TIME ZONE 'utc')::date) STORED,
  title TEXT,
  notes TEXT,
  source TEXT, -- e.g., 'ai_parsing', 'manual'
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Workout Exercises table
CREATE TABLE IF NOT EXISTS public.workout_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.workout_sessions(id) ON DELETE CASCADE,
  name_raw TEXT NOT NULL,
  name_canonical TEXT,
  primary_muscle_group TEXT,
  muscle_contributions JSONB, -- Array of {muscleGroup: string, fraction: number, isDirect: boolean}
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Workout Sets table
CREATE TABLE IF NOT EXISTS public.workout_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id UUID NOT NULL REFERENCES public.workout_exercises(id) ON DELETE CASCADE,
  set_index INTEGER NOT NULL,
  reps INTEGER NOT NULL,
  weight_text TEXT,
  weight_kg DECIMAL,
  is_bodyweight BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_sets ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Profiles: Users can only see and edit their own profile
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Workout Sessions: Users can only see and edit their own sessions
DROP POLICY IF EXISTS "Users can view own sessions" ON public.workout_sessions;
DROP POLICY IF EXISTS "Users can insert own sessions" ON public.workout_sessions;
DROP POLICY IF EXISTS "Users can update own sessions" ON public.workout_sessions;
DROP POLICY IF EXISTS "Users can delete own sessions" ON public.workout_sessions;
CREATE POLICY "Users can view own sessions" ON public.workout_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions" ON public.workout_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions" ON public.workout_sessions
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own sessions" ON public.workout_sessions
  FOR DELETE USING (auth.uid() = user_id);

-- Workout Exercises: Users can only see and edit exercises in their own sessions
DROP POLICY IF EXISTS "Users can view own exercises" ON public.workout_exercises;
DROP POLICY IF EXISTS "Users can insert own exercises" ON public.workout_exercises;
DROP POLICY IF EXISTS "Users can update own exercises" ON public.workout_exercises;
DROP POLICY IF EXISTS "Users can delete own exercises" ON public.workout_exercises;
CREATE POLICY "Users can view own exercises" ON public.workout_exercises
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.workout_sessions
      WHERE public.workout_sessions.id = public.workout_exercises.session_id
      AND public.workout_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own exercises" ON public.workout_exercises
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workout_sessions
      WHERE public.workout_sessions.id = public.workout_exercises.session_id
      AND public.workout_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own exercises" ON public.workout_exercises
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.workout_sessions
      WHERE public.workout_sessions.id = public.workout_exercises.session_id
      AND public.workout_sessions.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workout_sessions
      WHERE public.workout_sessions.id = public.workout_exercises.session_id
      AND public.workout_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own exercises" ON public.workout_exercises
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.workout_sessions
      WHERE public.workout_sessions.id = public.workout_exercises.session_id
      AND public.workout_sessions.user_id = auth.uid()
    )
  );

-- Workout Sets: Users can only see and edit sets in their own sessions
DROP POLICY IF EXISTS "Users can view own sets" ON public.workout_sets;
DROP POLICY IF EXISTS "Users can insert own sets" ON public.workout_sets;
DROP POLICY IF EXISTS "Users can update own sets" ON public.workout_sets;
DROP POLICY IF EXISTS "Users can delete own sets" ON public.workout_sets;
CREATE POLICY "Users can view own sets" ON public.workout_sets
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.workout_exercises
      JOIN public.workout_sessions ON public.workout_sessions.id = public.workout_exercises.session_id
      WHERE public.workout_exercises.id = public.workout_sets.exercise_id
      AND public.workout_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own sets" ON public.workout_sets
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workout_exercises
      JOIN public.workout_sessions ON public.workout_sessions.id = public.workout_exercises.session_id
      WHERE public.workout_exercises.id = public.workout_sets.exercise_id
      AND public.workout_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own sets" ON public.workout_sets
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.workout_exercises
      JOIN public.workout_sessions ON public.workout_sessions.id = public.workout_exercises.session_id
      WHERE public.workout_exercises.id = public.workout_sets.exercise_id
      AND public.workout_sessions.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workout_exercises
      JOIN public.workout_sessions ON public.workout_sessions.id = public.workout_exercises.session_id
      WHERE public.workout_exercises.id = public.workout_sets.exercise_id
      AND public.workout_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own sets" ON public.workout_sets
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.workout_exercises
      JOIN public.workout_sessions ON public.workout_sessions.id = public.workout_exercises.session_id
      WHERE public.workout_exercises.id = public.workout_sets.exercise_id
      AND public.workout_sessions.user_id = auth.uid()
    )
  );

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_workout_sessions_user_id_performed_on ON public.workout_sessions(user_id, performed_on DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_workout_sessions_user_day_title ON public.workout_sessions(user_id, performed_on_utc_day, coalesce(title, ''));
CREATE INDEX IF NOT EXISTS idx_workout_exercises_session_id ON public.workout_exercises(session_id);
CREATE INDEX IF NOT EXISTS idx_workout_sets_exercise_id ON public.workout_sets(exercise_id);

