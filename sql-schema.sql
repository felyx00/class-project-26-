-- ═══════════════════════════════════════════════════════════════════
-- SITS — Student Industrial Attachment Tracking System
-- PostgreSQL / Supabase Schema
-- ═══════════════════════════════════════════════════════════════════

-- 1. PROFILES (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT NOT NULL,
  full_name     TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('student', 'university_supervisor', 'industry_supervisor', 'admin')),
  admission_number TEXT,
  course        TEXT,
  phone         TEXT,
  avatar_url    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_admission ON profiles(admission_number);

-- 2. PLACEMENTS
CREATE TABLE IF NOT EXISTS placements (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  organisation_name TEXT NOT NULL,
  organisation_address TEXT,
  university_supervisor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  industry_supervisor_id   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  start_date    DATE,
  end_date      DATE,
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'terminated')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_placements_student ON placements(student_id);
CREATE INDEX idx_placements_uni_sup ON placements(university_supervisor_id);
CREATE INDEX idx_placements_ind_sup ON placements(industry_supervisor_id);
CREATE INDEX idx_placements_status ON placements(status);

-- 3. LOGBOOK ENTRIES
CREATE TABLE IF NOT EXISTS logbook_entries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  placement_id    UUID REFERENCES placements(id) ON DELETE CASCADE,
  entry_date      DATE NOT NULL,
  entry_type      TEXT NOT NULL DEFAULT 'daily' CHECK (entry_type IN ('daily', 'weekly')),
  title           TEXT NOT NULL,
  activities      TEXT NOT NULL,
  learning_points TEXT,
  challenges      TEXT,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'revision')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_entries_student ON logbook_entries(student_id);
CREATE INDEX idx_entries_placement ON logbook_entries(placement_id);
CREATE INDEX idx_entries_date ON logbook_entries(entry_date DESC);
CREATE INDEX idx_entries_status ON logbook_entries(status);

-- 4. FEEDBACK (supervisor review on each entry)
CREATE TABLE IF NOT EXISTS feedback (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id        UUID NOT NULL REFERENCES logbook_entries(id) ON DELETE CASCADE,
  supervisor_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  comments        TEXT NOT NULL,
  score           INTEGER CHECK (score >= 0 AND score <= 10),
  status          TEXT NOT NULL DEFAULT 'verified' CHECK (status IN ('verified', 'revision')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_feedback_entry ON feedback(entry_id);
CREATE INDEX idx_feedback_supervisor ON feedback(supervisor_id);

-- 5. ENTRY ATTACHMENTS (files in Supabase Storage)
CREATE TABLE IF NOT EXISTS entry_attachments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id        UUID NOT NULL REFERENCES logbook_entries(id) ON DELETE CASCADE,
  file_url        TEXT NOT NULL,
  file_name       TEXT NOT NULL,
  file_type       TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_attachments_entry ON entry_attachments(entry_id);

-- 6. EVALUATIONS (mid-term / final appraisal by supervisor)
CREATE TABLE IF NOT EXISTS evaluations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  placement_id    UUID NOT NULL REFERENCES placements(id) ON DELETE CASCADE,
  student_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  supervisor_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  milestone_type  TEXT NOT NULL CHECK (milestone_type IN ('midterm', 'final')),
  punctuality     INTEGER NOT NULL CHECK (punctuality >= 1 AND punctuality <= 5),
  technical       INTEGER NOT NULL CHECK (technical >= 1 AND technical <= 5),
  softskills      INTEGER NOT NULL CHECK (softskills >= 1 AND softskills <= 5),
  attendance      INTEGER NOT NULL CHECK (attendance >= 1 AND attendance <= 5),
  comments        TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_evaluations_placement ON evaluations(placement_id);
CREATE INDEX idx_evaluations_student ON evaluations(student_id);
CREATE INDEX idx_evaluations_supervisor ON evaluations(supervisor_id);

-- ═══════════════════════════════════════════════════════════════════
-- TRIGGER: auto-create profile on user signup
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, admission_number)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', 'User'),
    COALESCE(NEW.raw_user_meta_data ->> 'role', 'student'),
    NULLIF(NEW.raw_user_meta_data ->> 'admission_number', '')
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- ═══════════════════════════════════════════════════════════════════
-- TRIGGER: auto-update updated_at
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_placements_updated_at
  BEFORE UPDATE ON placements FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_logbook_entries_updated_at
  BEFORE UPDATE ON logbook_entries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ═══════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════════
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE placements ENABLE ROW LEVEL SECURITY;
ALTER TABLE logbook_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE entry_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluations ENABLE ROW LEVEL SECURITY;

-- PROFILES: users can read own profile; admins read all
CREATE POLICY profiles_select ON profiles FOR SELECT USING (
  auth.uid() = id OR
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY profiles_update ON profiles FOR UPDATE USING (auth.uid() = id);

-- PLACEMENTS: students see own; supervisors see assigned; admins see all
CREATE POLICY placements_select ON placements FOR SELECT USING (
  student_id = auth.uid() OR
  university_supervisor_id = auth.uid() OR
  industry_supervisor_id = auth.uid() OR
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY placements_insert ON placements FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY placements_update ON placements FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- LOGBOOK ENTRIES: students CRUD own; supervisors read assigned; admins all
CREATE POLICY entries_select ON logbook_entries FOR SELECT USING (
  student_id = auth.uid() OR
  EXISTS (SELECT 1 FROM placements WHERE (placements.university_supervisor_id = auth.uid() OR placements.industry_supervisor_id = auth.uid()) AND placements.student_id = logbook_entries.student_id) OR
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY entries_insert ON logbook_entries FOR INSERT WITH CHECK (
  student_id = auth.uid()
);
CREATE POLICY entries_update ON logbook_entries FOR UPDATE USING (
  student_id = auth.uid() OR
  EXISTS (SELECT 1 FROM placements WHERE (placements.university_supervisor_id = auth.uid() OR placements.industry_supervisor_id = auth.uid()) AND placements.student_id = logbook_entries.student_id) OR
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- FEEDBACK: supervisor inserts; student reads own; admin reads all
CREATE POLICY feedback_select ON feedback FOR SELECT USING (
  EXISTS (SELECT 1 FROM logbook_entries WHERE logbook_entries.id = feedback.entry_id AND (logbook_entries.student_id = auth.uid() OR logbook_entries.student_id IN (SELECT student_id FROM placements WHERE university_supervisor_id = auth.uid() OR industry_supervisor_id = auth.uid()))) OR
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY feedback_insert ON feedback FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM placements WHERE (university_supervisor_id = auth.uid() OR industry_supervisor_id = auth.uid()) AND student_id IN (SELECT student_id FROM logbook_entries WHERE id = feedback.entry_id))
  OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- ENTRY ATTACHMENTS: same as entries
CREATE POLICY attachments_select ON entry_attachments FOR SELECT USING (
  EXISTS (SELECT 1 FROM logbook_entries WHERE logbook_entries.id = entry_attachments.entry_id AND (logbook_entries.student_id = auth.uid() OR logbook_entries.student_id IN (SELECT student_id FROM placements WHERE university_supervisor_id = auth.uid() OR industry_supervisor_id = auth.uid()))) OR
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY attachments_insert ON entry_attachments FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM logbook_entries WHERE logbook_entries.id = entry_attachments.entry_id AND logbook_entries.student_id = auth.uid())
);
CREATE POLICY attachments_delete ON entry_attachments FOR DELETE USING (
  EXISTS (SELECT 1 FROM logbook_entries WHERE logbook_entries.id = entry_attachments.entry_id AND logbook_entries.student_id = auth.uid())
);

-- EVALUATIONS
CREATE POLICY evaluations_select ON evaluations FOR SELECT USING (
  student_id = auth.uid() OR
  supervisor_id = auth.uid() OR
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY evaluations_insert ON evaluations FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM placements WHERE (university_supervisor_id = auth.uid() OR industry_supervisor_id = auth.uid()) AND id = evaluations.placement_id) OR
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- ═══════════════════════════════════════════════════════════════════
-- STORAGE BUCKET for entry attachments
-- ═══════════════════════════════════════════════════════════════════
-- Run in Supabase SQL Editor:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('entry-attachments', 'entry-attachments', true);
--
-- Storage RLS (in Storage Policies):
-- CREATE POLICY "Students can upload their own attachments" ON storage.objects FOR INSERT WITH CHECK (
--   bucket_id = 'entry-attachments' AND auth.uid() = (storage.foldername(name))::uuid::text::uuid
-- );
-- CREATE POLICY "Anyone can view attachments" ON storage.objects FOR SELECT USING (
--   bucket_id = 'entry-attachments'
-- );
-- CREATE POLICY "Students can delete their own attachments" ON storage.objects FOR DELETE USING (
--   bucket_id = 'entry-attachments' AND auth.uid() = (storage.foldername(name))::uuid::text::uuid
-- );
