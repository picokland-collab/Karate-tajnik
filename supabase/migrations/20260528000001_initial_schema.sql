-- =============================================================================
-- Digitalni tajnik — Initial Schema
-- Migration: 20260528000001_initial_schema.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0. Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid() on older PG
CREATE EXTENSION IF NOT EXISTS "pg_trgm";    -- trigram index for name search


-- ---------------------------------------------------------------------------
-- 1. Enums
-- ---------------------------------------------------------------------------
CREATE TYPE belt_color AS ENUM (
  'bijeli', 'žuti', 'narančasti', 'zeleni',
  'plavi', 'smeđi', 'crni-1', 'crni-2', 'crni-3'
);

CREATE TYPE member_status AS ENUM (
  'aktivan', 'neaktivan', 'suspendiran'
);

CREATE TYPE member_category AS ENUM (
  'mali_karatist', 'kadet', 'junior', 'senior', 'veteran'
);

CREATE TYPE document_status AS ENUM (
  'nacrt', 'na_odobrenju', 'usvojeno'
);

CREATE TYPE document_type AS ENUM (
  'zapisnik', 'odluka', 'izvještaj', 'ugovor', 'ostalo'
);

CREATE TYPE meeting_type AS ENUM (
  'redovna', 'izvanredna', 'osnivačka'
);

CREATE TYPE meeting_status AS ENUM (
  'planirana', 'završena', 'otkazana'
);

CREATE TYPE competition_type AS ENUM (
  'kata', 'kumite', 'oboje'
);

CREATE TYPE competition_level AS ENUM (
  'klubsko', 'županijsko', 'državno', 'međunarodno'
);

CREATE TYPE medal_type AS ENUM (
  'zlato', 'srebro', 'bronca'
);

CREATE TYPE user_role AS ENUM (
  'admin', 'predsjednik', 'tajnik', 'trener', 'član'
);


-- ---------------------------------------------------------------------------
-- 2. Tables
-- ---------------------------------------------------------------------------

-- 2.1 clubs
-- One row per sports association / karate klub.
CREATE TABLE clubs (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                      TEXT        NOT NULL,
  short_name                TEXT,
  oib                       VARCHAR(11) UNIQUE NOT NULL,
  address                   TEXT,
  city                      TEXT,
  founded                   SMALLINT    CHECK (founded > 1800),
  president_name            TEXT,
  president_mandate_expiry  DATE,
  secretary_name            TEXT,
  email                     TEXT,
  phone                     TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE clubs IS 'One record per sports club / association (tenant root).';

-- 2.2 profiles
-- Extends auth.users with club membership and app role.
-- Created automatically via trigger on_auth_user_created (see section 5).
CREATE TABLE profiles (
  id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  club_id     UUID        REFERENCES clubs(id) ON DELETE SET NULL,
  full_name   TEXT,
  role        user_role   NOT NULL DEFAULT 'tajnik',
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE profiles IS 'App-level user profile; 1-to-1 with auth.users.';

-- 2.3 members
-- Athletes / club members register.
CREATE TABLE members (
  id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id         UUID            NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  first_name      TEXT            NOT NULL,
  last_name       TEXT            NOT NULL,
  email           TEXT,
  phone           TEXT,
  birth_date      DATE            NOT NULL,
  member_since    DATE            NOT NULL DEFAULT CURRENT_DATE,
  belt            belt_color      NOT NULL DEFAULT 'bijeli',
  status          member_status   NOT NULL DEFAULT 'aktivan',
  medical_expiry  DATE,
  consent_signed  BOOLEAN         NOT NULL DEFAULT false,
  guardian        TEXT,           -- parent/guardian name for minors
  notes           TEXT,
  avatar_url      TEXT,
  category        member_category NOT NULL,
  created_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ     NOT NULL DEFAULT now()
);
COMMENT ON TABLE members IS 'Club athletes / members. medical_expiry drives alert generation.';

-- 2.4 meetings
-- Skupštine (general assemblies).
-- date + time merged into scheduled_at TIMESTAMPTZ for simplicity.
CREATE TABLE meetings (
  id            UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id       UUID            NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  type          meeting_type    NOT NULL DEFAULT 'redovna',
  scheduled_at  TIMESTAMPTZ     NOT NULL,
  location      TEXT            NOT NULL,
  status        meeting_status  NOT NULL DEFAULT 'planirana',
  notes         TEXT,
  created_by    UUID            REFERENCES profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ     NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ     NOT NULL DEFAULT now()
);
COMMENT ON TABLE meetings IS 'General assembly records. agenda items stored in meeting_agenda_items.';

-- 2.5 meeting_agenda_items
-- Normalised replacement for Meeting.agenda string[].
CREATE TABLE meeting_agenda_items (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id  UUID        NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  position    SMALLINT    NOT NULL CHECK (position >= 0),
  body        TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (meeting_id, position)
);
COMMENT ON TABLE meeting_agenda_items IS 'Ordered agenda items for a meeting.';

-- 2.6 meeting_attendees
-- Normalised replacement for Meeting.attendees string[].
CREATE TABLE meeting_attendees (
  meeting_id    UUID        NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  member_id     UUID        NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  confirmed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (meeting_id, member_id)
);
COMMENT ON TABLE meeting_attendees IS 'Which members attended which meeting.';

-- 2.7 documents
-- Zapisnici, odluke, izvještaji, ugovori.
CREATE TABLE documents (
  id          UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id     UUID            NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  meeting_id  UUID            REFERENCES meetings(id) ON DELETE SET NULL,
  type        document_type   NOT NULL,
  title       TEXT            NOT NULL,
  status      document_status NOT NULL DEFAULT 'nacrt',
  content     TEXT,           -- full document text / AI-generated content
  author_id   UUID            REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ     NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ     NOT NULL DEFAULT now()
);
COMMENT ON TABLE documents IS 'All official club documents. content holds AI-generated or manual text.';

-- 2.8 competitions
-- Natjecanja.
CREATE TABLE competitions (
  id          UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id     UUID                NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  name        TEXT                NOT NULL,
  date        DATE                NOT NULL,
  location    TEXT                NOT NULL,
  type        competition_type    NOT NULL,
  level       competition_level   NOT NULL,
  created_at  TIMESTAMPTZ         NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ         NOT NULL DEFAULT now()
);
COMMENT ON TABLE competitions IS 'Competitions attended by club members.';

-- 2.9 competition_results
-- Normalised replacement for Competition.results[].
CREATE TABLE competition_results (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id  UUID        NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  member_id       UUID        NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  category        TEXT        NOT NULL,   -- e.g. "Junior muški do 68 kg"
  event           TEXT        NOT NULL,   -- 'Kumite' | 'Kata'
  place           SMALLINT    NOT NULL CHECK (place > 0),
  medal           medal_type,             -- NULL if place > 3
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (competition_id, member_id, event)
);
COMMENT ON TABLE competition_results IS 'Per-member results for each competition. memberName derived via JOIN.';

-- 2.10 activity_logs
-- Immutable audit trail. Never UPDATE or DELETE rows.
CREATE TABLE activity_logs (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id      UUID        NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  user_id      UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  action       TEXT        NOT NULL,   -- human-readable e.g. "dodao/la novog člana"
  entity_type  TEXT        NOT NULL,   -- 'Member' | 'Meeting' | 'Document' | 'Competition'
  entity_id    UUID,                   -- FK target (no hard FK — entity may be deleted)
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE activity_logs IS 'Append-only audit log. icon is derived from entity_type in the frontend.';


-- ---------------------------------------------------------------------------
-- 3. Indexes
-- ---------------------------------------------------------------------------

-- members: most queries filter by club + status
CREATE INDEX idx_members_club_id         ON members (club_id);
CREATE INDEX idx_members_club_status     ON members (club_id, status);
CREATE INDEX idx_members_medical_expiry  ON members (club_id, medical_expiry);
CREATE INDEX idx_members_consent         ON members (club_id, consent_signed) WHERE consent_signed = false;

-- Full-text search on member name (trigram)
CREATE INDEX idx_members_name_trgm ON members
  USING gin ((first_name || ' ' || last_name) gin_trgm_ops);

-- meetings
CREATE INDEX idx_meetings_club_id      ON meetings (club_id);
CREATE INDEX idx_meetings_scheduled_at ON meetings (club_id, scheduled_at);
CREATE INDEX idx_meetings_status       ON meetings (club_id, status);

-- documents
CREATE INDEX idx_documents_club_id    ON documents (club_id);
CREATE INDEX idx_documents_status     ON documents (club_id, status);
CREATE INDEX idx_documents_meeting_id ON documents (meeting_id);

-- competitions
CREATE INDEX idx_competitions_club_id ON competitions (club_id);
CREATE INDEX idx_competitions_date    ON competitions (club_id, date DESC);

-- competition_results
CREATE INDEX idx_competition_results_competition ON competition_results (competition_id);
CREATE INDEX idx_competition_results_member      ON competition_results (member_id);

-- activity_logs: always queried newest-first per club
CREATE INDEX idx_activity_logs_club_created ON activity_logs (club_id, created_at DESC);


-- ---------------------------------------------------------------------------
-- 4. updated_at trigger
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_clubs_updated_at
  BEFORE UPDATE ON clubs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_members_updated_at
  BEFORE UPDATE ON members
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_meetings_updated_at
  BEFORE UPDATE ON meetings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_competitions_updated_at
  BEFORE UPDATE ON competitions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ---------------------------------------------------------------------------
-- 5. Auto-create profile on Supabase Auth signup
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- ---------------------------------------------------------------------------
-- 6. RLS — Row Level Security
-- All tables: users see only their own club's rows.
-- ---------------------------------------------------------------------------

-- Helper: returns the club_id of the authenticated user.
-- SECURITY DEFINER so it can read profiles even when profiles has RLS.
CREATE OR REPLACE FUNCTION get_my_club_id()
RETURNS UUID
LANGUAGE SQL STABLE
SECURITY DEFINER SET search_path = public
AS $$
  SELECT club_id FROM profiles WHERE id = auth.uid();
$$;

-- ---- clubs ----
ALTER TABLE clubs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clubs: member can read own club"
  ON clubs FOR SELECT
  USING (id = get_my_club_id());

CREATE POLICY "clubs: admin can update own club"
  ON clubs FOR UPDATE
  USING (id = get_my_club_id())
  WITH CHECK (id = get_my_club_id());

-- ---- profiles ----
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles: user can read own profile"
  ON profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "profiles: user can update own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Admins can read all profiles in their club
CREATE POLICY "profiles: read club members"
  ON profiles FOR SELECT
  USING (club_id = get_my_club_id());

-- ---- members ----
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members: club read"   ON members FOR SELECT USING (club_id = get_my_club_id());
CREATE POLICY "members: club insert" ON members FOR INSERT WITH CHECK (club_id = get_my_club_id());
CREATE POLICY "members: club update" ON members FOR UPDATE USING (club_id = get_my_club_id()) WITH CHECK (club_id = get_my_club_id());
CREATE POLICY "members: club delete" ON members FOR DELETE USING (club_id = get_my_club_id());

-- ---- meetings ----
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "meetings: club read"   ON meetings FOR SELECT USING (club_id = get_my_club_id());
CREATE POLICY "meetings: club insert" ON meetings FOR INSERT WITH CHECK (club_id = get_my_club_id());
CREATE POLICY "meetings: club update" ON meetings FOR UPDATE USING (club_id = get_my_club_id()) WITH CHECK (club_id = get_my_club_id());
CREATE POLICY "meetings: club delete" ON meetings FOR DELETE USING (club_id = get_my_club_id());

-- ---- meeting_agenda_items ----
ALTER TABLE meeting_agenda_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agenda: club read" ON meeting_agenda_items FOR SELECT
  USING (meeting_id IN (SELECT id FROM meetings WHERE club_id = get_my_club_id()));
CREATE POLICY "agenda: club insert" ON meeting_agenda_items FOR INSERT
  WITH CHECK (meeting_id IN (SELECT id FROM meetings WHERE club_id = get_my_club_id()));
CREATE POLICY "agenda: club update" ON meeting_agenda_items FOR UPDATE
  USING (meeting_id IN (SELECT id FROM meetings WHERE club_id = get_my_club_id()));
CREATE POLICY "agenda: club delete" ON meeting_agenda_items FOR DELETE
  USING (meeting_id IN (SELECT id FROM meetings WHERE club_id = get_my_club_id()));

-- ---- meeting_attendees ----
ALTER TABLE meeting_attendees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "attendees: club read" ON meeting_attendees FOR SELECT
  USING (meeting_id IN (SELECT id FROM meetings WHERE club_id = get_my_club_id()));
CREATE POLICY "attendees: club insert" ON meeting_attendees FOR INSERT
  WITH CHECK (meeting_id IN (SELECT id FROM meetings WHERE club_id = get_my_club_id()));
CREATE POLICY "attendees: club delete" ON meeting_attendees FOR DELETE
  USING (meeting_id IN (SELECT id FROM meetings WHERE club_id = get_my_club_id()));

-- ---- documents ----
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "documents: club read"   ON documents FOR SELECT USING (club_id = get_my_club_id());
CREATE POLICY "documents: club insert" ON documents FOR INSERT WITH CHECK (club_id = get_my_club_id());
CREATE POLICY "documents: club update" ON documents FOR UPDATE USING (club_id = get_my_club_id()) WITH CHECK (club_id = get_my_club_id());
CREATE POLICY "documents: club delete" ON documents FOR DELETE USING (club_id = get_my_club_id());

-- ---- competitions ----
ALTER TABLE competitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "competitions: club read"   ON competitions FOR SELECT USING (club_id = get_my_club_id());
CREATE POLICY "competitions: club insert" ON competitions FOR INSERT WITH CHECK (club_id = get_my_club_id());
CREATE POLICY "competitions: club update" ON competitions FOR UPDATE USING (club_id = get_my_club_id()) WITH CHECK (club_id = get_my_club_id());
CREATE POLICY "competitions: club delete" ON competitions FOR DELETE USING (club_id = get_my_club_id());

-- ---- competition_results ----
ALTER TABLE competition_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "results: club read" ON competition_results FOR SELECT
  USING (competition_id IN (SELECT id FROM competitions WHERE club_id = get_my_club_id()));
CREATE POLICY "results: club insert" ON competition_results FOR INSERT
  WITH CHECK (competition_id IN (SELECT id FROM competitions WHERE club_id = get_my_club_id()));
CREATE POLICY "results: club update" ON competition_results FOR UPDATE
  USING (competition_id IN (SELECT id FROM competitions WHERE club_id = get_my_club_id()));
CREATE POLICY "results: club delete" ON competition_results FOR DELETE
  USING (competition_id IN (SELECT id FROM competitions WHERE club_id = get_my_club_id()));

-- ---- activity_logs ----
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "logs: club read"   ON activity_logs FOR SELECT USING (club_id = get_my_club_id());
CREATE POLICY "logs: club insert" ON activity_logs FOR INSERT WITH CHECK (club_id = get_my_club_id());
-- No UPDATE or DELETE on logs — append-only by design.


-- ---------------------------------------------------------------------------
-- 7. Computed alerts VIEW
-- Replaces the hardcoded alerts[] array in mock-data.ts.
-- Returns one row per alert condition per club.
-- ---------------------------------------------------------------------------
CREATE VIEW club_alerts AS

-- Mandate expiry within 90 days
SELECT
  c.id                                            AS club_id,
  'mandate_expiry'                                AS alert_key,
  CASE WHEN c.president_mandate_expiry - CURRENT_DATE <= 30 THEN 'critical'
       ELSE 'warning' END                         AS severity,
  'Istek mandata predsjednika'                    AS title,
  'Mandat predsjednika ' || c.president_name ||
    ' ističe za ' ||
    (c.president_mandate_expiry - CURRENT_DATE)::TEXT ||
    ' dana (' || to_char(c.president_mandate_expiry, 'DD.MM.YYYY.') || ').' AS description,
  NULL::INTEGER                                   AS count,
  '/skupstine'                                    AS action_url
FROM clubs c
WHERE c.president_mandate_expiry IS NOT NULL
  AND c.president_mandate_expiry - CURRENT_DATE BETWEEN 0 AND 90

UNION ALL

-- Expired medical exams
SELECT
  m.club_id,
  'medical_expired',
  'warning',
  'Istekli liječnički pregledi',
  count(*)::TEXT || ' članova ima istekle liječničke preglede i ne mogu natjecati.',
  count(*)::INTEGER,
  '/clanovi'
FROM members m
WHERE m.medical_expiry < CURRENT_DATE
  AND m.status = 'aktivan'
GROUP BY m.club_id
HAVING count(*) > 0

UNION ALL

-- Medical expiring within 60 days
SELECT
  m.club_id,
  'medical_expiring_soon',
  'info',
  'Liječnički pregled uskoro ističe',
  count(*)::TEXT || ' članova ima liječnički pregled koji ističe u sljedećih 60 dana.',
  count(*)::INTEGER,
  '/clanovi'
FROM members m
WHERE m.medical_expiry BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '60 days'
  AND m.status = 'aktivan'
GROUP BY m.club_id
HAVING count(*) > 0

UNION ALL

-- Unsigned consents for minors
SELECT
  m.club_id,
  'unsigned_consent',
  'warning',
  'Nepotpisane privole',
  count(*)::TEXT || ' maloljetnih članova nema potpisanu privolu roditelja.',
  count(*)::INTEGER,
  '/clanovi'
FROM members m
WHERE m.consent_signed = false
  AND (CURRENT_DATE - m.birth_date) / 365 < 18
GROUP BY m.club_id
HAVING count(*) > 0

UNION ALL

-- Upcoming meetings in next 30 days
SELECT
  mt.club_id,
  'upcoming_meeting',
  'info',
  'Skupština zakazana',
  initcap(mt.type::TEXT) || ' skupština zakazana je za ' ||
    to_char(mt.scheduled_at, 'DD.MM.YYYY. u HH24:MI') || 'h.',
  NULL::INTEGER,
  '/skupstine'
FROM meetings mt
WHERE mt.status = 'planirana'
  AND mt.scheduled_at BETWEEN now() AND now() + INTERVAL '30 days';

COMMENT ON VIEW club_alerts IS
  'Computed alerts derived from live data. Replaces hardcoded alerts[] in mock-data.ts.';
