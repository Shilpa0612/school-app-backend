-- Lists Management Database Setup
-- This file contains the database schema for the lists management system

-- Create uniforms table
CREATE TABLE public.uniforms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    grade_level TEXT NOT NULL,
    gender TEXT CHECK (gender IN ('boys', 'girls', 'unisex')),
    season TEXT CHECK (season IN ('summer', 'winter', 'all')),
    price DECIMAL(10,2),
    supplier TEXT,
    notes TEXT,
    is_required BOOLEAN DEFAULT true,
    created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create books table
CREATE TABLE public.books (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    author TEXT,
    publisher TEXT,
    isbn TEXT,
    grade_level TEXT NOT NULL,
    subject TEXT,
    edition TEXT,
    price DECIMAL(10,2),
    supplier TEXT,
    notes TEXT,
    is_required BOOLEAN DEFAULT true,
    created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create staff table
CREATE TABLE public.staff (
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
CREATE INDEX idx_uniforms_grade_level ON public.uniforms(grade_level);
CREATE INDEX idx_uniforms_gender ON public.uniforms(gender);
CREATE INDEX idx_uniforms_season ON public.uniforms(season);
CREATE INDEX idx_books_grade_level ON public.books(grade_level);
CREATE INDEX idx_books_subject ON public.books(subject);
CREATE INDEX idx_staff_role ON public.staff(role);
CREATE INDEX idx_staff_department ON public.staff(department);
CREATE INDEX idx_staff_is_active ON public.staff(is_active);
CREATE INDEX idx_staff_user_id ON public.staff(user_id); -- Index for user_id

-- Enable Row Level Security (RLS)
ALTER TABLE public.uniforms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;

-- RLS Policies for uniforms table
CREATE POLICY "Anyone can view uniforms" ON public.uniforms
    FOR SELECT USING (true);

CREATE POLICY "Admins and principals can manage uniforms" ON public.uniforms
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('admin', 'principal')
        )
    );

-- RLS Policies for books table
CREATE POLICY "Anyone can view books" ON public.books
    FOR SELECT USING (true);

CREATE POLICY "Admins and principals can manage books" ON public.books
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('admin', 'principal')
        )
    );

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

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_lists_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_uniforms_updated_at 
    BEFORE UPDATE ON public.uniforms 
    FOR EACH ROW EXECUTE FUNCTION update_lists_updated_at_column();

CREATE TRIGGER update_books_updated_at 
    BEFORE UPDATE ON public.books 
    FOR EACH ROW EXECUTE FUNCTION update_lists_updated_at_column();

CREATE TRIGGER update_staff_updated_at 
    BEFORE UPDATE ON public.staff 
    FOR EACH ROW EXECUTE FUNCTION update_lists_updated_at_column(); 