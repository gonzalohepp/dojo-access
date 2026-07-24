-- Create member_grades table
CREATE TABLE IF NOT EXISTS member_grades (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(user_id) ON DELETE CASCADE NOT NULL,
  grade TEXT NOT NULL,
  awarded_at DATE DEFAULT CURRENT_DATE,
  instructor_id UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS for member_grades
ALTER TABLE member_grades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public grades are viewable by everyone" ON member_grades
  FOR SELECT USING (true); -- Or restrict to authenticated if preferred

CREATE POLICY "Admins and instructors can manage grades" ON member_grades
  FOR ALL USING (
    auth.uid() IN (
      SELECT user_id FROM profiles WHERE role IN ('admin', 'instructor')
    )
  );

-- Create class_attendance table
CREATE TABLE IF NOT EXISTS class_attendance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(user_id) ON DELETE CASCADE NOT NULL,
  class_id BIGINT REFERENCES classes(id) ON DELETE CASCADE NOT NULL,
  date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, class_id, date) -- Prevent double check-in same day same class
);

-- RLS for class_attendance
ALTER TABLE class_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own attendance" ON class_attendance
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can check-in themselves" ON class_attendance
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins and instructors can view all attendance" ON class_attendance
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM profiles WHERE role IN ('admin', 'instructor')
    )
  );
