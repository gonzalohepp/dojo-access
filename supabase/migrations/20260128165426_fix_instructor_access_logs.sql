-- Drop the existing specific policy
DROP POLICY IF EXISTS "Admins can log any access" ON public.access_logs;

-- Create updated policy that includes instructors
CREATE POLICY "Admins and Instructors can log manual access"
ON public.access_logs
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role IN ('admin', 'instructor')
  )
);
