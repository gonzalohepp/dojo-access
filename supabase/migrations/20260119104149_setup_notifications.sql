-- 1. Table for queued notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES profiles(user_id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  url text DEFAULT '/',
  created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);

-- 2. Trigger Function to automatically notify admins on member access denial
CREATE OR REPLACE FUNCTION public.handle_access_denial_notification()
RETURNS TRIGGER AS $$
DECLARE
  admin_id uuid;
  member_name text;
BEGIN
  -- Only for denied results
  IF (NEW.result = 'denied' OR NEW.result = 'denegado') THEN
    
    -- Get member name
    SELECT (first_name || ' ' || last_name) INTO member_name 
    FROM profiles WHERE user_id = NEW.user_id;

    -- Insert a notification for each admin
    FOR admin_id IN SELECT user_id FROM profiles WHERE role = 'admin' LOOP
      INSERT INTO public.notifications (user_id, title, body, url)
      VALUES (
        admin_id, 
        'Acceso Denegado 🚩', 
        'El alumno ' || COALESCE(member_name, 'Desconocido') || ' fue rechazado: ' || COALESCE(NEW.reason, 'Sin motivo'),
        '/admin'
      );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Trigger
DROP TRIGGER IF EXISTS on_access_denial ON public.access_logs;
CREATE TRIGGER on_access_denial
  AFTER INSERT ON public.access_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_access_denial_notification();
