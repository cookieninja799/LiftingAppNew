-- Phase 2 Blockers Fix Migration
-- Removes soft-delete semantics, adds UTC day uniqueness, completes RLS

-- 1. Remove deleted_at column from workout_sessions
ALTER TABLE public.workout_sessions DROP COLUMN IF EXISTS deleted_at;

-- 2. Add generated UTC day column for uniqueness constraint
ALTER TABLE public.workout_sessions 
  ADD COLUMN IF NOT EXISTS performed_on_utc_day DATE 
  GENERATED ALWAYS AS ((performed_on AT TIME ZONE 'utc')::date) STORED;

-- 3. Add unique constraint on (user_id, utc_day, title)
CREATE UNIQUE INDEX IF NOT EXISTS uq_workout_sessions_user_day_title 
  ON public.workout_sessions(user_id, performed_on_utc_day, coalesce(title, ''));

-- 4. Update RLS policies to add WITH CHECK and DELETE policies

-- Profiles
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Workout Sessions
DROP POLICY IF EXISTS "Users can update own sessions" ON public.workout_sessions;
DROP POLICY IF EXISTS "Users can delete own sessions" ON public.workout_sessions;

CREATE POLICY "Users can update own sessions" ON public.workout_sessions
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own sessions" ON public.workout_sessions
  FOR DELETE USING (auth.uid() = user_id);

-- Workout Exercises
DROP POLICY IF EXISTS "Users can update own exercises" ON public.workout_exercises;
DROP POLICY IF EXISTS "Users can delete own exercises" ON public.workout_exercises;

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

-- Workout Sets
DROP POLICY IF EXISTS "Users can update own sets" ON public.workout_sets;
DROP POLICY IF EXISTS "Users can delete own sets" ON public.workout_sets;

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



