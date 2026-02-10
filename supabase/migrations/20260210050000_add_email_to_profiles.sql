-- Add email column to profiles so edge functions can look up users by email
ALTER TABLE public.profiles ADD COLUMN email text;
CREATE INDEX idx_profiles_email ON public.profiles (email);
