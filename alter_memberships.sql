-- Add last_payment_date to memberships table
ALTER TABLE memberships 
ADD COLUMN IF NOT EXISTS last_payment_date DATE;

-- Initialize last_payment_date with start_date for existing records (fallback)
UPDATE memberships 
SET last_payment_date = start_date 
WHERE last_payment_date IS NULL;

-- Optional: Add comments
COMMENT ON COLUMN memberships.start_date IS 'Fecha de inicio original (antigüedad)';
COMMENT ON COLUMN memberships.last_payment_date IS 'Fecha del último pago/renovación';
