-- Add a unique constraint based on the endpoint to avoid duplicate notifications per device
ALTER TABLE public.push_subscriptions 
ADD COLUMN IF NOT EXISTS endpoint text;

-- Extract endpoint from JSON for existing rows (if any) and set the column
UPDATE public.push_subscriptions 
SET endpoint = subscription->>'endpoint'
WHERE endpoint IS NULL;

-- 3. Cleanup existing duplicates before adding constraint
-- Keeps only the most recent subscription for each unique endpoint
DELETE FROM public.push_subscriptions a USING public.push_subscriptions b
WHERE a.id < b.id AND a.endpoint = b.endpoint;

-- 4. Make it unique per user/device
ALTER TABLE public.push_subscriptions 
DROP CONSTRAINT IF EXISTS unique_subscription_endpoint;

ALTER TABLE public.push_subscriptions 
ADD CONSTRAINT unique_subscription_endpoint UNIQUE (endpoint);
