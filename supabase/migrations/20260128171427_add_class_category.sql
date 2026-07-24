-- Add category column to classes table
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS category text DEFAULT 'artes-marciales';

-- Update existing records if necessary (optional, but good for consistency)
-- UPDATE public.classes SET category = 'artes-marciales' WHERE category IS NULL;
