-- Add initial plaintext password storage for parent onboarding
-- WARNING: Storing plaintext passwords is insecure. Use only for short-term operational needs
-- and consider clearing this field after first login.

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS initial_password text;

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS initial_password_set_at timestamp with time zone;

COMMENT ON COLUMN public.users.initial_password IS 'Temporarily stores a plaintext password provided during admin-created parent onboarding. Should be cleared after first login.';
COMMENT ON COLUMN public.users.initial_password_set_at IS 'Timestamp when initial_password was set.';

