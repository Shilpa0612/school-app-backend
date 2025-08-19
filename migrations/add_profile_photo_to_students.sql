-- Add profile photo path column to students_master
ALTER TABLE public.students_master
ADD COLUMN IF NOT EXISTS profile_photo_path text;

COMMENT ON COLUMN public.students_master.profile_photo_path IS 'Supabase Storage path to the student profile photo (e.g., profile-pictures/students/{student_id}/avatar.jpg)';

