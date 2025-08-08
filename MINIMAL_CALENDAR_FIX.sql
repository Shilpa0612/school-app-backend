-- Minimal Calendar Events Fix
-- Only add missing function and RLS policies

-- Create function to get events with IST timezone conversion
CREATE OR REPLACE FUNCTION get_events_with_ist(
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

-- Update RLS policies for calendar_events (drop existing ones first)
DROP POLICY IF EXISTS "Anyone can view calendar events" ON public.calendar_events;
DROP POLICY IF EXISTS "Users can create calendar events" ON public.calendar_events;
DROP POLICY IF EXISTS "Users can update their own calendar events" ON public.calendar_events;
DROP POLICY IF EXISTS "Users can delete their own calendar events" ON public.calendar_events;

-- Create new RLS policies
CREATE POLICY "Anyone can view calendar events"
ON public.calendar_events FOR SELECT
USING (true);

CREATE POLICY "Admin and Principal can create all calendar events"
ON public.calendar_events FOR INSERT
WITH CHECK (
    auth.role() IN ('admin', 'principal')
);

CREATE POLICY "Teachers can create class-specific events for their classes"
ON public.calendar_events FOR INSERT
WITH CHECK (
    auth.role() = 'teacher' 
    AND event_type = 'class_specific'
    AND class_division_id IN (
        SELECT cd.id 
        FROM public.class_divisions cd
        JOIN public.teacher_class_assignments tca ON 
            tca.academic_year = (SELECT year_name FROM public.academic_years WHERE is_active = true)
            AND tca.class_level = (SELECT name FROM public.class_levels WHERE id = cd.class_level_id)
            AND tca.division = cd.division
        WHERE tca.teacher_id = auth.uid()
    )
);

CREATE POLICY "Users can update their own calendar events"
ON public.calendar_events FOR UPDATE
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Admin and Principal can update any calendar events"
ON public.calendar_events FOR UPDATE
USING (auth.role() IN ('admin', 'principal'))
WITH CHECK (auth.role() IN ('admin', 'principal'));

CREATE POLICY "Users can delete their own calendar events"
ON public.calendar_events FOR DELETE
USING (created_by = auth.uid());

CREATE POLICY "Admin and Principal can delete any calendar events"
ON public.calendar_events FOR DELETE
USING (auth.role() IN ('admin', 'principal')); 