CREATE TABLE IF NOT EXISTS notification_history (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    title text NOT NULL,
    message text NOT NULL,
    target text NOT NULL,
    url text,
    sent_by uuid REFERENCES profiles(user_id),
    sent_at timestamptz DEFAULT now(),
    count integer DEFAULT 0,
    status text DEFAULT 'sent'
);

-- RLS
ALTER TABLE notification_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all notification history"
ON notification_history
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role = 'admin'
  )
);

CREATE POLICY "Admins can insert notification history"
ON notification_history
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role = 'admin'
  )
);
