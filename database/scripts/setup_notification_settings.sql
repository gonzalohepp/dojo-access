CREATE TABLE IF NOT EXISTS notification_settings (
    id text PRIMARY KEY,
    day_10_enabled boolean DEFAULT true,
    day_10_days integer[] DEFAULT '{8, 9, 10}',
    day_10_time text DEFAULT '10:00',
    expiry_enabled boolean DEFAULT true,
    expiry_days integer[] DEFAULT '{18, 19, 20}',
    expiry_time text DEFAULT '10:00',
    updated_at timestamptz DEFAULT now()
);

-- Insert default settings
INSERT INTO notification_settings (id, day_10_enabled, day_10_days, day_10_time, expiry_enabled, expiry_days, expiry_time)
VALUES ('reminders', true, '{8, 9, 10}', '10:00', true, '{18, 19, 20}', '10:00')
ON CONFLICT (id) DO NOTHING;

-- RLS
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view settings"
ON notification_settings FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role = 'admin'
  )
);

CREATE POLICY "Admins can update settings"
ON notification_settings FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role = 'admin'
  )
);
