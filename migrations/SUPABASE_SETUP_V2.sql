-- 1. Enable Extensions
create extension if not exists "uuid-ossp";

-- 2. Create Storage Buckets (Do this manually in Supabase Dashboard)
-- Go to Storage > New Bucket and create:
-- - homework-attachments (private)
-- - profile-pictures (private)

-- 3. Create Base Tables

-- Academic Years
create table public.academic_years (
    id uuid primary key default uuid_generate_v4(),
    year_name text not null unique,
    start_date date not null,
    end_date date not null,
    is_active boolean default false,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create unique index for active academic year
create unique index idx_active_academic_year on academic_years (is_active) where is_active = true;

-- Class Levels
create table public.class_levels (
    id uuid primary key default uuid_generate_v4(),
    name text not null unique,
    sequence_number integer not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Class Divisions
create table public.class_divisions (
    id uuid primary key default uuid_generate_v4(),
    academic_year_id uuid references public.academic_years(id) on delete restrict,
    class_level_id uuid references public.class_levels(id) on delete restrict,
    division text not null,
    teacher_id uuid references public.users(id) on delete restrict,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    unique(academic_year_id, class_level_id, division)
);

-- Users
create table public.users (
    id uuid primary key default uuid_generate_v4(),
    phone_number text unique not null,
    password_hash text not null,
    role text not null check (role in ('admin', 'principal', 'teacher', 'parent')),
    full_name text not null,
    email text,
    preferred_language text default 'english' check (preferred_language in ('english', 'hindi', 'marathi')),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    last_login timestamp with time zone
);

-- Students Master
create table public.students_master (
    id uuid primary key default uuid_generate_v4(),
    admission_number text unique not null,
    full_name text not null,
    date_of_birth date not null,
    admission_date date not null,
    status text default 'active' check (status in ('active', 'transferred', 'graduated', 'inactive')),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Student Academic Records
create table public.student_academic_records (
    id uuid primary key default uuid_generate_v4(),
    student_id uuid references public.students_master(id) on delete restrict,
    academic_year_id uuid references public.academic_years(id) on delete restrict,
    class_division_id uuid references public.class_divisions(id) on delete restrict,
    roll_number text,
    status text default 'ongoing' check (status in ('ongoing', 'promoted', 'detained', 'transferred')),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    unique(student_id, academic_year_id)
);

-- Parent-Student Mappings
create table public.parent_student_mappings (
    id uuid primary key default uuid_generate_v4(),
    parent_id uuid references public.users(id) on delete cascade,
    student_id uuid references public.students_master(id) on delete cascade,
    relationship text not null check (relationship in ('father', 'mother', 'guardian')),
    is_primary_guardian boolean default false,
    access_level text default 'full' check (access_level in ('full', 'restricted', 'readonly')),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    unique(parent_id, student_id)
);

-- Messages
create table public.messages (
    id uuid primary key default uuid_generate_v4(),
    sender_id uuid references public.users(id) on delete restrict,
    class_division_id uuid references public.class_divisions(id) on delete restrict,
    recipient_id uuid references public.users(id) on delete restrict,
    content text not null,
    type text not null check (type in ('individual', 'group', 'announcement')),
    status text not null check (status in ('pending', 'approved', 'rejected')) default 'pending',
    approved_by uuid references public.users(id) on delete restrict,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Homework
create table public.homework (
    id uuid primary key default uuid_generate_v4(),
    class_division_id uuid references public.class_divisions(id) on delete restrict not null,
    teacher_id uuid references public.users(id) on delete restrict not null,
    subject text not null,
    title text not null,
    description text not null,
    due_date timestamp with time zone not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Homework Files
create table public.homework_files (
    id uuid primary key default uuid_generate_v4(),
    homework_id uuid references public.homework(id) on delete cascade not null,
    storage_path text not null,
    file_name text not null,
    file_type text not null,
    file_size bigint not null,
    uploaded_by uuid references public.users(id) on delete restrict not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Calendar Events
create table public.calendar_events (
    id uuid primary key default uuid_generate_v4(),
    title text not null,
    description text not null,
    event_date timestamp with time zone not null,
    created_by uuid references public.users(id) on delete restrict not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Leave Requests
create table public.leave_requests (
    id uuid primary key default uuid_generate_v4(),
    student_id uuid references public.students_master(id) on delete restrict not null,
    requested_by uuid references public.users(id) on delete restrict not null,
    start_date date not null,
    end_date date not null,
    reason text not null,
    status text not null check (status in ('pending', 'approved', 'rejected')) default 'pending',
    approved_by uuid references public.users(id) on delete restrict,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- File Access Logs
create table public.file_access_logs (
    id uuid primary key default uuid_generate_v4(),
    file_path text not null,
    accessed_by uuid references public.users(id) on delete restrict not null,
    access_type text not null check (access_type in ('read', 'write', 'delete')),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);



-- Teacher Class Assignments table to track which teacher taught which class in which year
CREATE TABLE public.teacher_class_assignments (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    teacher_id uuid REFERENCES public.users(id),
    academic_year text NOT NULL,
    class_level text NOT NULL,
    division text NOT NULL,
    subject text,
    is_class_teacher boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(teacher_id, academic_year, class_level, division, subject)
);

-- Enable RLS
ALTER TABLE public.teacher_class_assignments ENABLE ROW LEVEL SECURITY;

-- Policies for teacher_class_assignments
CREATE POLICY "Anyone can view teacher assignments"
ON public.teacher_class_assignments FOR SELECT
USING (true);

CREATE POLICY "Admin and Principal can manage teacher assignments"
ON public.teacher_class_assignments FOR ALL
USING (
    auth.role() IN ('admin', 'principal')
)
WITH CHECK (
    auth.role() IN ('admin', 'principal')
);

-- Function to assign teacher to class
CREATE OR REPLACE FUNCTION assign_teacher_to_class(
    p_teacher_id uuid,
    p_academic_year text,
    p_class_level text,
    p_division text,
    p_subject text DEFAULT NULL,
    p_is_class_teacher boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_assignment_id uuid;
BEGIN
    -- Verify teacher exists and is actually a teacher
    IF NOT EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = p_teacher_id 
        AND role = 'teacher'
    ) THEN
        RAISE EXCEPTION 'Invalid teacher ID or user is not a teacher';
    END IF;

    -- If this is a class teacher assignment, check if class already has one
    IF p_is_class_teacher THEN
        IF EXISTS (
            SELECT 1 FROM public.teacher_class_assignments
            WHERE academic_year = p_academic_year
            AND class_level = p_class_level
            AND division = p_division
            AND is_class_teacher = true
            AND teacher_id != p_teacher_id
        ) THEN
            RAISE EXCEPTION 'Class already has a class teacher assigned';
        END IF;
    END IF;

    -- Insert or update assignment
    INSERT INTO public.teacher_class_assignments (
        teacher_id,
        academic_year,
        class_level,
        division,
        subject,
        is_class_teacher
    )
    VALUES (
        p_teacher_id,
        p_academic_year,
        p_class_level,
        p_division,
        p_subject,
        p_is_class_teacher
    )
    ON CONFLICT (teacher_id, academic_year, class_level, division, subject)
    DO UPDATE SET
        is_class_teacher = EXCLUDED.is_class_teacher
    RETURNING id INTO v_assignment_id;

    RETURN v_assignment_id;
END;
$$;

-- Function to get student history with teachers
CREATE OR REPLACE FUNCTION get_student_history(p_student_id uuid)
RETURNS TABLE (
    academic_year text,
    class_level text,
    division text,
    roll_number text,
    class_teacher_name text,
    status text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sar.academic_year,
        sar.class_level,
        sar.division,
        sar.roll_number,
        u.full_name as class_teacher_name,
        sar.status
    FROM public.student_academic_records sar
    LEFT JOIN public.teacher_class_assignments tca ON 
        tca.academic_year = sar.academic_year
        AND tca.class_level = sar.class_level
        AND tca.division = sar.division
        AND tca.is_class_teacher = true
    LEFT JOIN public.users u ON u.id = tca.teacher_id
    WHERE sar.student_id = p_student_id
    ORDER BY sar.academic_year DESC;
END;
$$;

-- Indexes for teacher_class_assignments
CREATE INDEX idx_teacher_assignments_teacher ON public.teacher_class_assignments(teacher_id);
CREATE INDEX idx_teacher_assignments_year ON public.teacher_class_assignments(academic_year);
CREATE INDEX idx_teacher_assignments_class ON public.teacher_class_assignments(class_level, division);

-- Enable Row Level Security
alter table public.academic_years enable row level security;
alter table public.class_levels enable row level security;
alter table public.class_divisions enable row level security;
alter table public.users enable row level security;
alter table public.students_master enable row level security;
alter table public.student_academic_records enable row level security;
alter table public.parent_student_mappings enable row level security;
alter table public.messages enable row level security;
alter table public.homework enable row level security;
alter table public.homework_files enable row level security;
alter table public.calendar_events enable row level security;
alter table public.leave_requests enable row level security;
alter table public.file_access_logs enable row level security;

-- Create Policies

-- Academic Years policies
create policy "Anyone can view academic years"
on public.academic_years for select
using (true);

create policy "Admin can manage academic years"
on public.academic_years for all
using (
    exists (
        select 1 from public.users
        where id = auth.uid() and role = 'admin'
    )
);

-- Class Levels policies
create policy "Anyone can view class levels"
on public.class_levels for select
using (true);

create policy "Admin can manage class levels"
on public.class_levels for all
using (
    exists (
        select 1 from public.users
        where id = auth.uid() and role = 'admin'
    )
);

-- Class Divisions policies
create policy "Anyone can view class divisions"
on public.class_divisions for select
using (true);

create policy "Admin and Principal can manage class divisions"
on public.class_divisions for all
using (
    exists (
        select 1 from public.users
        where id = auth.uid() and role in ('admin', 'principal')
    )
);

-- Users policies
create policy "Users can view their own data"
on public.users for select
using (auth.uid() = id);

create policy "Admin can manage all users"
on public.users for all
using (
    exists (
        select 1 from public.users
        where id = auth.uid() and role = 'admin'
    )
);

-- Students policies
create policy "Admin and teachers can view students"
on public.students_master for select
using (
    exists (
        select 1 from public.users
        where id = auth.uid() and role in ('admin', 'principal', 'teacher')
    )
);

create policy "Admin can manage students"
on public.students_master for all
using (
    exists (
        select 1 from public.users
        where id = auth.uid() and role = 'admin'
    )
);

-- Student Academic Records policies
create policy "Teachers can view their class records"
on public.student_academic_records for select
using (
    exists (
        select 1 from public.class_divisions cd
        where cd.id = student_academic_records.class_division_id
        and cd.teacher_id = auth.uid()
    ) or
    exists (
        select 1 from public.users
        where id = auth.uid() and role in ('admin', 'principal')
    )
);

-- Storage policies
create policy "Users can access their own files"
on storage.objects for all
using (
    bucket_id in ('homework-attachments', 'profile-pictures')
    and (
        exists (
            select 1 from public.users
            where id = auth.uid()
            and (
                role in ('admin', 'principal')
                or (
                    role = 'teacher'
                    and exists (
                        select 1 from public.homework_files
                        where storage_path = storage.objects.name
                        and uploaded_by = auth.uid()
                    )
                )
            )
        )
    )
);

-- Create Functions

-- Function to promote students
create or replace function promote_students(p_from_academic_year_id uuid, p_to_academic_year_id uuid)
returns table (
    student_id uuid,
    old_class_id uuid,
    new_class_id uuid,
    status text
) 
language plpgsql
security definer
as $$
begin
    if not exists (select 1 from academic_years where id = p_to_academic_year_id and is_active = true) then
        raise exception 'Target academic year must be active';
    end if;

    return query
    with student_promotions as (
        select 
            sar.student_id,
            sar.class_division_id as old_class_id,
            cd.class_level_id,
            cl.sequence_number,
            sm.status as student_status
        from student_academic_records sar
        join class_divisions cd on cd.id = sar.class_division_id
        join class_levels cl on cl.id = cd.class_level_id
        join students_master sm on sm.id = sar.student_id
        where sar.academic_year_id = p_from_academic_year_id
        and sm.status = 'active'
    )
    insert into student_academic_records (
        student_id,
        academic_year_id,
        class_division_id,
        status
    )
    select 
        sp.student_id,
        p_to_academic_year_id,
        (
            select cd.id
            from class_divisions cd
            join class_levels cl on cl.id = cd.class_level_id
            where cd.academic_year_id = p_to_academic_year_id
            and cl.sequence_number = sp.sequence_number + 1
            limit 1
        ),
        'ongoing'
    from student_promotions sp
    returning student_id, old_class_id, class_division_id, status;
end;
$$;

-- Additional Functions

-- Function to handle file uploads logging
create or replace function handle_file_upload()
returns trigger
language plpgsql
security definer
as $$
begin
    insert into public.file_access_logs (file_path, accessed_by, access_type)
    values (new.name, auth.uid(), 'write');
    return new;
end;
$$;

-- Function to assign student to class
create or replace function assign_student_to_class(
    p_student_id uuid,
    p_class_division_id uuid,
    p_roll_number text
)
returns uuid
language plpgsql
security definer
as $$
declare
    v_academic_year_id uuid;
    v_record_id uuid;
begin
    -- Get current academic year
    select id into v_academic_year_id
    from academic_years
    where is_active = true;

    if not found then
        raise exception 'No active academic year found';
    end if;

    -- Create academic record
    insert into student_academic_records (
        student_id,
        academic_year_id,
        class_division_id,
        roll_number,
        status
    )
    values (
        p_student_id,
        v_academic_year_id,
        p_class_division_id,
        p_roll_number,
        'ongoing'
    )
    returning id into v_record_id;

    return v_record_id;
end;
$$;

-- Function to validate parent-student relationship
create or replace function validate_parent_student_relationship()
returns trigger
language plpgsql
security definer
as $$
begin
    -- Check if trying to set as primary guardian when one already exists
    if new.is_primary_guardian then
        if exists (
            select 1 from parent_student_mappings
            where student_id = new.student_id
            and is_primary_guardian = true
            and id != coalesce(new.id, uuid_generate_v4())
        ) then
            raise exception 'Student already has a primary guardian';
        end if;
    end if;
    return new;
end;
$$;

-- Additional Triggers

-- Trigger for file upload logging
create trigger on_storage_insert
    after insert on storage.objects
    for each row execute function handle_file_upload();

-- Trigger for parent-student relationship validation
create trigger before_parent_student_mapping
    before insert or update on parent_student_mappings
    for each row execute function validate_parent_student_relationship();

-- Trigger for updating timestamps
create trigger update_parent_student_mapping_timestamp
    before update on parent_student_mappings
    for each row
    execute function update_updated_at_column();

-- Additional Policies

-- Parent-Student Mapping policies
create policy "Parents can view their own mappings"
on parent_student_mappings for select
using (
    parent_id = auth.uid() or
    exists (
        select 1 from users
        where id = auth.uid() and role in ('admin', 'principal')
    )
);

create policy "Admin can manage parent-student mappings"
on parent_student_mappings for all
using (
    exists (
        select 1 from users
        where id = auth.uid() and role = 'admin'
    )
);

-- Student Academic Records policies
create policy "Parents can view their children's records"
on student_academic_records for select
using (
    exists (
        select 1 from parent_student_mappings
        where parent_id = auth.uid()
        and student_id = student_academic_records.student_id
    ) or
    exists (
        select 1 from users
        where id = auth.uid() and role in ('admin', 'principal', 'teacher')
    )
);

-- Homework policies
create policy "Teachers can manage their class homework"
on homework for all
using (
    exists (
        select 1 from class_divisions
        where id = homework.class_division_id
        and teacher_id = auth.uid()
    ) or
    exists (
        select 1 from users
        where id = auth.uid() and role in ('admin', 'principal')
    )
);

-- Create Indexes
create index if not exists idx_users_role on public.users(role);
create index if not exists idx_users_phone on public.users(phone_number);
create index if not exists idx_academic_years_active on public.academic_years(is_active);
create index if not exists idx_class_divisions_academic_year on public.class_divisions(academic_year_id);
create index if not exists idx_class_divisions_teacher on public.class_divisions(teacher_id);
create index if not exists idx_student_records_student on public.student_academic_records(student_id);
create index if not exists idx_student_records_academic_year on public.student_academic_records(academic_year_id);
create index if not exists idx_student_records_class on public.student_academic_records(class_division_id);
create index if not exists idx_parent_student_parent on public.parent_student_mappings(parent_id);
create index if not exists idx_parent_student_student on public.parent_student_mappings(student_id);
create index if not exists idx_messages_sender on public.messages(sender_id);
create index if not exists idx_messages_class on public.messages(class_division_id);
create index if not exists idx_homework_class on public.homework(class_division_id);
create index if not exists idx_leave_requests_student on public.leave_requests(student_id); 

-- Academic Records indexes
create index idx_student_records_status on student_academic_records(status);
create index idx_student_records_created on student_academic_records(created_at);

-- Parent-Student indexes
create index idx_parent_student_primary on parent_student_mappings(is_primary_guardian);
create index idx_parent_student_relationship on parent_student_mappings(relationship);

-- Messages indexes
create index idx_messages_type on messages(type);
create index idx_messages_created on messages(created_at);

-- Homework indexes
create index idx_homework_due_date on homework(due_date);
create index idx_homework_subject on homework(subject);

-- Calendar indexes
create index idx_calendar_event_date on calendar_events(event_date);

-- File Access Logs indexes
create index idx_file_access_logs_path on file_access_logs(file_path);
create index idx_file_access_logs_type on file_access_logs(access_type);
create index idx_file_access_logs_accessed_by on file_access_logs(accessed_by);

-- Additional Constraints

-- Ensure end_date is after start_date in academic_years
alter table academic_years
add constraint academic_year_dates_check
check (end_date > start_date);

-- Ensure leave request end_date is after or equal to start_date
alter table leave_requests
add constraint leave_request_dates_check
check (end_date >= start_date);

-- Ensure only one primary guardian per student
create unique index idx_primary_guardian
on parent_student_mappings (student_id)
where is_primary_guardian = true;

-- Ensure unique roll numbers within a class division
create unique index idx_unique_roll_number
on student_academic_records (class_division_id, roll_number)
where status = 'ongoing';

-- Initial Setup Function
create or replace function initialize_school_year(
    p_year_name text,
    p_start_date date,
    p_end_date date
)
returns uuid
language plpgsql
security definer
as $$
declare
    v_year_id uuid;
begin
    -- Deactivate current active year if exists
    update academic_years
    set is_active = false
    where is_active = true;

    -- Create new academic year
    insert into academic_years (
        year_name,
        start_date,
        end_date,
        is_active
    )
    values (
        p_year_name,
        p_start_date,
        p_end_date,
        true
    )
    returning id into v_year_id;

    return v_year_id;
end;
$$; 