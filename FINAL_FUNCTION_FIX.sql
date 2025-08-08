-- Final fix for the calendar events function
-- Drop the existing function with date parameters and create the correct one

-- Drop the existing function with the exact signature we found
DROP FUNCTION IF EXISTS get_events_with_ist(
    p_start_date date DEFAULT NULL::date, 
    p_end_date date DEFAULT NULL::date, 
    p_class_division_id uuid DEFAULT NULL::uuid, 
    p_event_type text DEFAULT NULL::text, 
    p_event_category text DEFAULT NULL::text
);

-- Create the function with the correct timestamp parameters
CREATE FUNCTION get_events_with_ist(
    p_start_date timestamp with time zone DEFAULT NULL,
    p_end_date timestamp with time zone DEFAULT NULL,
    p_class_division_id uuid DEFAULT NULL,
    p_event_type text DEFAULT NULL,
    p_event_category text DEFAULT NULL
)
RETURNS TABLE (
    id uuid,
    title text,
    description text,
    event_date timestamp with time zone,
    event_date_ist timestamp with time zone,
    event_type text,
    class_division_id uuid,
    is_single_day boolean,
    start_time time,
    end_time time,
    event_category text,
    timezone text,
    created_by uuid,
    created_at timestamp with time zone,
    creator_name text,
    creator_role text,
    class_info jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ce.id,
        ce.title,
        ce.description,
        ce.event_date,
        ce.event_date + INTERVAL '5 hours 30 minutes' as event_date_ist,
        ce.event_type,
        ce.class_division_id,
        ce.is_single_day,
        ce.start_time,
        ce.end_time,
        ce.event_category,
        ce.timezone,
        ce.created_by,
        ce.created_at,
        u.full_name as creator_name,
        u.role as creator_role,
        CASE 
            WHEN ce.class_division_id IS NOT NULL THEN
                jsonb_build_object(
                    'id', cd.id,
                    'division', cd.division,
                    'academic_year', ay.year_name,
                    'class_level', cl.name
                )
            ELSE NULL
        END as class_info
    FROM public.calendar_events ce
    LEFT JOIN public.users u ON u.id = ce.created_by
    LEFT JOIN public.class_divisions cd ON cd.id = ce.class_division_id
    LEFT JOIN public.academic_years ay ON ay.id = cd.academic_year_id
    LEFT JOIN public.class_levels cl ON cl.id = cd.class_level_id
    WHERE (p_start_date IS NULL OR ce.event_date >= p_start_date)
      AND (p_end_date IS NULL OR ce.event_date <= p_end_date)
      AND (p_class_division_id IS NULL OR ce.class_division_id = p_class_division_id)
      AND (p_event_type IS NULL OR ce.event_type = p_event_type)
      AND (p_event_category IS NULL OR ce.event_category = p_event_category)
    ORDER BY ce.event_date ASC;
END;
$$;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION get_events_with_ist TO authenticated;

-- Verify the function was created correctly
SELECT 
    p.proname as function_name,
    pg_get_function_arguments(p.oid) as arguments,
    pg_get_function_result(p.oid) as return_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'get_events_with_ist'
AND n.nspname = 'public'; 