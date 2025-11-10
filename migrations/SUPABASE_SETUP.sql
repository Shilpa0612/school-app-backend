-- Enable Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create Tables

-- 1. Academic Years
CREATE TABLE academic_years (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    year_name VARCHAR(9) NOT NULL UNIQUE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create unique index for active academic year
CREATE UNIQUE INDEX idx_active_academic_year ON academic_years (is_active) WHERE is_active = true;

-- 2. Users Table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone_number VARCHAR(15) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(10) CHECK (role IN ('admin', 'principal', 'teacher', 'parent')) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    preferred_language VARCHAR(10) DEFAULT 'english' CHECK (preferred_language IN ('english', 'hindi', 'marathi')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP WITH TIME ZONE
);

-- 3. Class Levels
CREATE TABLE class_levels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(20) NOT NULL,
    sequence_number INT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(name)
);

-- 4. Class Divisions
CREATE TABLE class_divisions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    academic_year_id UUID REFERENCES academic_years(id),
    class_level_id UUID REFERENCES class_levels(id),
    division VARCHAR(2) NOT NULL,
    teacher_id UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(academic_year_id, class_level_id, division)
);

-- 5. Students Master
CREATE TABLE students_master (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admission_number VARCHAR(20) UNIQUE NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    date_of_birth DATE NOT NULL,
    admission_date DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'transferred', 'graduated', 'inactive')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Student Academic Records
CREATE TABLE student_academic_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES students_master(id),
    academic_year_id UUID REFERENCES academic_years(id),
    class_division_id UUID REFERENCES class_divisions(id),
    roll_number VARCHAR(20),
    status VARCHAR(20) DEFAULT 'ongoing' CHECK (status IN ('ongoing', 'promoted', 'detained', 'transferred')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, academic_year_id)
);

-- 7. Parent-Student Mappings
CREATE TABLE parent_student_mappings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parent_id UUID REFERENCES users(id),
    student_id UUID REFERENCES students_master(id),
    relationship VARCHAR(20) CHECK (relationship IN ('father', 'mother', 'guardian')),
    is_primary_guardian BOOLEAN DEFAULT false,
    access_level VARCHAR(20) DEFAULT 'full' CHECK (access_level IN ('full', 'restricted', 'readonly')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(parent_id, student_id)
);

-- 8. Messages
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_id UUID REFERENCES users(id),
    class_division_id UUID REFERENCES class_divisions(id),
    recipient_id UUID REFERENCES users(id),
    content TEXT NOT NULL,
    type VARCHAR(15) CHECK (type IN ('individual', 'group', 'announcement')) NOT NULL,
    status VARCHAR(10) CHECK (status IN ('pending', 'approved', 'rejected')) NOT NULL DEFAULT 'pending',
    approved_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. Homework
CREATE TABLE homework (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_division_id UUID REFERENCES class_divisions(id) NOT NULL,
    teacher_id UUID REFERENCES users(id) NOT NULL,
    subject VARCHAR(50) NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    due_date TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 10. Homework Files
CREATE TABLE homework_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    homework_id UUID REFERENCES homework(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    file_size BIGINT NOT NULL,
    uploaded_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 11. Calendar Events
CREATE TABLE calendar_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    event_date TIMESTAMP WITH TIME ZONE NOT NULL,
    created_by UUID REFERENCES users(id) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 12. Leave Requests
CREATE TABLE leave_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES students_master(id) NOT NULL,
    requested_by UUID REFERENCES users(id) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT NOT NULL,
    status VARCHAR(10) CHECK (status IN ('pending', 'approved', 'rejected')) NOT NULL DEFAULT 'pending',
    approved_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create Functions

-- Function to promote students
CREATE OR REPLACE FUNCTION promote_students(p_from_academic_year_id UUID, p_to_academic_year_id UUID)
RETURNS TABLE (
    student_id UUID,
    old_class_id UUID,
    new_class_id UUID,
    status TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Validate academic years
    IF NOT EXISTS (SELECT 1 FROM academic_years WHERE id = p_to_academic_year_id AND is_active = true) THEN
        RAISE EXCEPTION 'Target academic year must be active';
    END IF;

    RETURN QUERY
    WITH student_promotions AS (
        SELECT 
            sar.student_id,
            sar.class_division_id as old_class_id,
            cd.class_level_id,
            cl.sequence_number,
            sm.status as student_status
        FROM student_academic_records sar
        JOIN class_divisions cd ON cd.id = sar.class_division_id
        JOIN class_levels cl ON cl.id = cd.class_level_id
        JOIN students_master sm ON sm.id = sar.student_id
        WHERE sar.academic_year_id = p_from_academic_year_id
        AND sm.status = 'active'
    )
    INSERT INTO student_academic_records (
        student_id,
        academic_year_id,
        class_division_id,
        status
    )
    SELECT 
        sp.student_id,
        p_to_academic_year_id,
        (
            SELECT cd.id
            FROM class_divisions cd
            JOIN class_levels cl ON cl.id = cd.class_level_id
            WHERE cd.academic_year_id = p_to_academic_year_id
            AND cl.sequence_number = sp.sequence_number + 1
            LIMIT 1
        ),
        'ongoing'
    FROM student_promotions sp
    RETURNING student_id, old_class_id, class_division_id, status;
END;
$$;

-- Function to assign student to class
CREATE OR REPLACE FUNCTION assign_student_to_class(
    p_student_id UUID,
    p_class_division_id UUID,
    p_roll_number VARCHAR(20)
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_academic_year_id UUID;
    v_record_id UUID;
BEGIN
    -- Get current academic year
    SELECT id INTO v_academic_year_id
    FROM academic_years
    WHERE is_active = true;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No active academic year found';
    END IF;

    -- Create or update academic record
    INSERT INTO student_academic_records (
        student_id,
        academic_year_id,
        class_division_id,
        roll_number,
        status
    )
    VALUES (
        p_student_id,
        v_academic_year_id,
        p_class_division_id,
        p_roll_number,
        'ongoing'
    )
    ON CONFLICT (student_id, academic_year_id)
    DO UPDATE SET
        class_division_id = EXCLUDED.class_division_id,
        roll_number = EXCLUDED.roll_number
    RETURNING id INTO v_record_id;

    RETURN v_record_id;
END;
$$;

-- Enable Row Level Security
ALTER TABLE academic_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_divisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE students_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_academic_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE parent_student_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE homework ENABLE ROW LEVEL SECURITY;
ALTER TABLE homework_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;

-- Create Policies

-- Users policies
CREATE POLICY "Users can view their own data"
ON users FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Admin can manage all users"
ON users FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM users
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- Class policies
CREATE POLICY "Anyone can view class information"
ON class_divisions FOR SELECT
USING (true);

CREATE POLICY "Admin and Principal can manage classes"
ON class_divisions FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM users
        WHERE id = auth.uid() AND role IN ('admin', 'principal')
    )
);

-- Student policies
CREATE POLICY "Teachers can view their class students"
ON student_academic_records FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM class_divisions
        WHERE id = student_academic_records.class_division_id
        AND teacher_id = auth.uid()
    )
);

-- Create Indexes
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_phone ON users(phone_number);
CREATE INDEX idx_class_divisions_teacher ON class_divisions(teacher_id);
CREATE INDEX idx_class_divisions_academic_year ON class_divisions(academic_year_id);
CREATE INDEX idx_student_records_student ON student_academic_records(student_id);
CREATE INDEX idx_student_records_class ON student_academic_records(class_division_id);
CREATE INDEX idx_parent_student_parent ON parent_student_mappings(parent_id);
CREATE INDEX idx_parent_student_student ON parent_student_mappings(student_id);
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_class ON messages(class_division_id);
CREATE INDEX idx_homework_class ON homework(class_division_id);
CREATE INDEX idx_leave_requests_student ON leave_requests(student_id);