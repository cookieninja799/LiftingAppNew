# Applying Phase 2 Database Migration

## Prerequisites

- Supabase CLI installed (`npm install -g supabase`)
- Database backup completed
- Access to Supabase project

## Option 1: Using Supabase CLI (Recommended)

```bash
# 1. Link to your Supabase project
supabase link --project-ref YOUR_PROJECT_REF

# 2. Apply the migration
supabase db push

# 3. Verify the changes
supabase db diff
```

## Option 2: Manual SQL Execution

### Via Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy contents of `migrations/001_phase2_blockers_fix.sql`
4. Paste and execute

### Via psql

```bash
# Connect to your database
psql "postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"

# Execute migration
\i supabase/migrations/001_phase2_blockers_fix.sql
```

## Verification Steps

After applying the migration, verify:

### 1. Check deleted_at column is removed
```sql
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'workout_sessions' 
  AND column_name = 'deleted_at';
-- Should return 0 rows
```

### 2. Check UTC day column exists
```sql
SELECT column_name, data_type, generation_expression
FROM information_schema.columns 
WHERE table_name = 'workout_sessions' 
  AND column_name = 'performed_on_utc_day';
-- Should show DATE type with generation expression
```

### 3. Check unique index exists
```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'workout_sessions'
  AND indexname = 'uq_workout_sessions_user_day_title';
-- Should return the unique index definition
```

### 4. Verify RLS policies
```sql
-- Check DELETE policies exist
SELECT policyname, cmd
FROM pg_policies
WHERE tablename IN ('workout_sessions', 'workout_exercises', 'workout_sets')
  AND cmd = 'DELETE';
-- Should return 3 policies (one per table)

-- Check UPDATE policies have WITH CHECK
SELECT policyname, cmd, with_check
FROM pg_policies
WHERE tablename IN ('workout_sessions', 'workout_exercises', 'workout_sets')
  AND cmd = 'UPDATE';
-- All should have with_check defined
```

### 5. Test delete operation
```sql
-- As an authenticated user, try deleting a session
-- This should cascade to exercises and sets
BEGIN;
DELETE FROM workout_sessions WHERE id = 'some-test-session-id';
ROLLBACK; -- Don't commit, just testing
```

## Rollback (Emergency Only)

If you need to rollback:

```sql
-- 1. Re-add deleted_at column
ALTER TABLE public.workout_sessions 
  ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- 2. Drop UTC day column
ALTER TABLE public.workout_sessions 
  DROP COLUMN performed_on_utc_day;

-- 3. Drop unique index
DROP INDEX IF EXISTS uq_workout_sessions_user_day_title;

-- 4. Restore old RLS policies (see previous schema version)
```

**Warning**: Rollback will not restore data that was hard-deleted after migration.

## Monitoring

After deployment, monitor:

1. **Error logs** for UUID validation failures
2. **RLS policy violations** (should be none if working correctly)
3. **Duplicate session errors** from unique constraint
4. **Cascade delete behavior** (exercises/sets should auto-delete)

## Support

If issues occur:
- Check Supabase logs in dashboard
- Review client-side error logs
- Verify user authentication is working
- Ensure app version matches schema version



