-- Add a unique constraint based on the endpoint to avoid duplicate notifications per device
ALTER TABLE public.push_subscriptions 
ADD COLUMN IF NOT EXISTS endpoint text;

-- Extract endpoint from JSON for existing rows (if any) and set the column
UPDATE public.push_subscriptions 
SET endpoint = subscription->>'endpoint'
WHERE endpoint IS NULL;

-- Make it unique per user/device
ALTER TABLE public.push_subscriptions 
DROP CONSTRAINT IF EXISTS unique_subscription_endpoint;

ALTER TABLE public.push_subscriptions 
ADD CONSTRAINT unique_subscription_endpoint UNIQUE (endpoint);
