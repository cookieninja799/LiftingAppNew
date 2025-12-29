-- Phase 3: AI Rate Limiting Migration
-- Creates rate limiting table and RPC function for AI requests

-- Create rate limit table
CREATE TABLE IF NOT EXISTS public.ai_rate_limit (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  window_start TIMESTAMPTZ NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, window_start)
);

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_ai_rate_limit_user_window 
  ON public.ai_rate_limit(user_id, window_start DESC);

-- Enable RLS
ALTER TABLE public.ai_rate_limit ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see their own rate limit records
CREATE POLICY "Users can view own rate limits" ON public.ai_rate_limit
  FOR SELECT USING (auth.uid() = user_id);

-- RLS Policy: Users can insert/update their own rate limit records
CREATE POLICY "Users can manage own rate limits" ON public.ai_rate_limit
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RPC Function: Check and increment rate limit atomically
CREATE OR REPLACE FUNCTION public.rate_limit_ai_request(
  window_seconds INTEGER DEFAULT 60,
  max_requests INTEGER DEFAULT 10
)
RETURNS TABLE(allowed BOOLEAN, remaining INTEGER, reset_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_window_start TIMESTAMPTZ;
  current_count INTEGER;
  user_id_val UUID;
BEGIN
  -- Get current user ID
  user_id_val := auth.uid();
  
  IF user_id_val IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;

  -- Calculate current window start (round down to window_seconds boundary)
  -- For example, if window_seconds=60, round down to the minute
  -- If window_seconds=300 (5 min), round down to 5-minute boundary
  current_window_start := date_trunc('epoch', NOW())::BIGINT / window_seconds * window_seconds;
  current_window_start := to_timestamp(current_window_start);

  -- Atomic upsert: increment count or insert new record
  INSERT INTO public.ai_rate_limit (user_id, window_start, count)
  VALUES (user_id_val, current_window_start, 1)
  ON CONFLICT (user_id, window_start)
  DO UPDATE SET count = ai_rate_limit.count + 1
  RETURNING count INTO current_count;

  -- Check if limit exceeded
  IF current_count > max_requests THEN
    RETURN QUERY SELECT 
      FALSE AS allowed,
      0 AS remaining,
      current_window_start + (window_seconds || ' seconds')::INTERVAL AS reset_at;
  ELSE
    RETURN QUERY SELECT 
      TRUE AS allowed,
      max_requests - current_count AS remaining,
      current_window_start + (window_seconds || ' seconds')::INTERVAL AS reset_at;
  END IF;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.rate_limit_ai_request(INTEGER, INTEGER) TO authenticated;

