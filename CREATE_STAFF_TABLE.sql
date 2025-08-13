-- Create staff table with all necessary columns and relationships
-- Run this in your Supabase SQL editor

-- Create staff table
CREATE TABLE IF NOT EXISTS public.staff (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE, -- Link to users table
    full_name TEXT NOT NULL,
    phone_number TEXT,
    email TEXT,
    role TEXT NOT NULL,
    subject TEXT, -- For teachers
    department TEXT,
    designation TEXT,
    joining_date DATE,
    address TEXT,
    emergency_contact TEXT,
    emergency_contact_phone TEXT,
    is_active BOOLEAN DEFAULT true,
    created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_staff_role ON public.staff(role);
CREATE INDEX IF NOT EXISTS idx_staff_department ON public.staff(department);
CREATE INDEX IF NOT EXISTS idx_staff_is_active ON public.staff(is_active);
CREATE INDEX IF NOT EXISTS idx_staff_user_id ON public.staff(user_id);
CREATE INDEX IF NOT EXISTS idx_staff_phone_number ON public.staff(phone_number);

-- Enable Row Level Security (RLS)
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;

-- RLS Policies for staff table
CREATE POLICY "Anyone can view active staff" ON public.staff
    FOR SELECT USING (is_active = true);

CREATE POLICY "Admins and principals can view all staff" ON public.staff
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('admin', 'principal')
        )
    );

CREATE POLICY "Admins and principals can manage staff" ON public.staff
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('admin', 'principal')
        )
    );

-- Create function to update updated_at timestamp (if not exists)
CREATE OR REPLACE FUNCTION update_lists_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at (if not exists)
DROP TRIGGER IF EXISTS update_staff_updated_at ON public.staff;
CREATE TRIGGER update_staff_updated_at 
    BEFORE UPDATE ON public.staff 
    FOR EACH ROW EXECUTE FUNCTION update_lists_updated_at_column();

-- Verify the table was created
SELECT 
    table_name, 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'staff' 
ORDER BY ordinal_position;
