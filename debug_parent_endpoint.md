# Debug Parent Endpoint - Empty Results Issue

## Issue

Parent endpoint returns empty results even though school-wide events exist in the database.

## Debug Steps

### 1. Check if Parent Has Children Linked

```sql
-- Check if parent has any children
SELECT * FROM parent_student_mappings
WHERE parent_id = 'YOUR_PARENT_USER_ID';
```

### 2. Check if Database Function Exists

```sql
-- Check if the function exists
SELECT
    p.proname as function_name,
    pg_get_function_arguments(p.oid) as arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname = 'get_parent_events_with_ist';
```

### 3. Test Database Function Directly

```sql
-- Test the function with sample data
SELECT * FROM get_parent_events_with_ist(
    '2024-01-01'::timestamp with time zone,
    '2025-12-31'::timestamp with time zone,
    NULL,
    ARRAY[]::uuid[]  -- Empty array for no class-specific events
);
```

### 4. Check School-wide Events Exist

```sql
-- Check if school-wide events exist
SELECT * FROM calendar_events
WHERE event_type = 'school_wide';
```

### 5. Test Regular Query (use_ist=false)

Try the endpoint with `use_ist=false` to bypass the database function:

```bash
curl -X GET "http://localhost:3000/calendar/events/parent?use_ist=false" \
  -H "Authorization: Bearer PARENT_TOKEN"
```

### 6. Check RLS Policies

```sql
-- Check if RLS is blocking access
SELECT * FROM calendar_events
WHERE event_type = 'school_wide'
LIMIT 1;
```

## Possible Issues and Solutions

### Issue 1: Parent Has No Children

**Solution**: Link parent to students first

```bash
# Link parent to student
curl -X POST http://localhost:3000/parent-student/link \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer PARENT_TOKEN" \
  -d '{
    "student_id": "STUDENT_UUID",
    "relationship": "parent"
  }'
```

### Issue 2: Database Function Not Working

**Solution**: Use regular query instead

```bash
curl -X GET "http://localhost:3000/calendar/events/parent?use_ist=false" \
  -H "Authorization: Bearer PARENT_TOKEN"
```

### Issue 3: RLS Policy Blocking Access

**Solution**: Check and fix RLS policies

```sql
-- Check current RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'calendar_events';
```

### Issue 4: Function Parameters Wrong

**Solution**: Update function call in code

The function might be expecting different parameters. Check the function signature and update the call accordingly.

## Test Commands

### Test with Different Parameters

```bash
# Test with date range
curl -X GET "http://localhost:3000/calendar/events/parent?start_date=2024-01-01&end_date=2025-12-31" \
  -H "Authorization: Bearer PARENT_TOKEN"

# Test with category
curl -X GET "http://localhost:3000/calendar/events/parent?event_category=holiday" \
  -H "Authorization: Bearer PARENT_TOKEN"
```

### Test Regular Events Endpoint

```bash
# Test if regular events endpoint works
curl -X GET "http://localhost:3000/calendar/events" \
  -H "Authorization: Bearer PARENT_TOKEN"
```

## Expected Results

If everything is working correctly:

1. **Parent with children**: Should see both school-wide and class-specific events
2. **Parent without children**: Should see only school-wide events
3. **Database function working**: Should see IST timezone conversion
4. **Regular query fallback**: Should work even if function fails

## Next Steps

1. Run the debug queries above
2. Check if parent has children linked
3. Test with `use_ist=false` parameter
4. Verify database function exists and works
5. Check RLS policies are not blocking access
