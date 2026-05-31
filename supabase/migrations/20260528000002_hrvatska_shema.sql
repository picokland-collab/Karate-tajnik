-- =============================================================================
-- Digitalni tajnik — Hrvatska shema v2
-- Migracija: 20260528000002_hrvatska_shema.sql
--
-- Ova migracija:
--   1. Dodaje 11 PostgreSQL enuma s hrvatskim nazivima
--   2. Nadograđuje postojeće tablice (nedestruktivno — bez gubitka podataka)
--   3. Stvara 8 novih tablica s potpunim hrvatskim nazivima
--   4. Uvodi strogi RLS na SVIH 26 tablica (18 postojećih + 8 novih)
--   5. Stvara pogled upozorenja (zamjena za hardkodirani niz u mock-data.ts)
--   6. Dodaje 17 indeksa za brze upite
--
-- SIGURNOSNA NAPOMENA:
--   Tablica korisnici.lozinka sadrži lozinke u čistom tekstu.
--   Preporučamo migraciju na Supabase Auth što je prije moguće.
--   Tablica super_admini blokirana je za sve uloge osim service_role.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 0. PROŠIRENJA
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pg_trgm";   -- trigram pretraživanje po imenu


-- ---------------------------------------------------------------------------
-- 1. ENUMI (svi nazivi na hrvatskom / ASCII-sigurni)
-- ---------------------------------------------------------------------------

CREATE TYPE boja_pojasa AS ENUM (
  'bijeli', 'zuti', 'narancasti', 'zeleni',
  'plavi', 'smedji', 'crni_1', 'crni_2', 'crni_3'
);

CREATE TYPE status_clana AS ENUM (
  'aktivan', 'neaktivan', 'suspendiran'
);

CREATE TYPE kategorija_clana AS ENUM (
  'mali_karatist', 'kadet', 'junior', 'senior', 'veteran'
);

CREATE TYPE status_dokumenta AS ENUM (
  'nacrt', 'na_odobrenju', 'usvojeno'
);

CREATE TYPE vrsta_dokumenta AS ENUM (
  'zapisnik', 'odluka', 'izvjestaj', 'ugovor', 'ostalo'
);

CREATE TYPE vrsta_sjednice AS ENUM (
  'redovna', 'izvanredna', 'osnivacka'
);

CREATE TYPE status_sjednice AS ENUM (
  'planirana', 'zavrsena', 'otkazana'
);

CREATE TYPE vrsta_natjecanja AS ENUM (
  'kata', 'kumite', 'oboje'
);

CREATE TYPE razina_natjecanja AS ENUM (
  'klubsko', 'zupanijsko', 'drzavno', 'medjunarodno'
);

CREATE TYPE vrsta_medalje AS ENUM (
  'zlato', 'srebro', 'bronca'
);

CREATE TYPE uloga_korisnika AS ENUM (
  'admin', 'predsjednik', 'tajnik', 'trener', 'clan'
);


-- ---------------------------------------------------------------------------
-- 2. NADOGRADNJA POSTOJEĆIH TABLICA (nedestruktivno)
-- ---------------------------------------------------------------------------

-- klubovi: dodaj stupce koji nedostaju za upozorenja i novu aplikaciju
ALTER TABLE klubovi
  ADD COLUMN IF NOT EXISTS grad               TEXT,
  ADD COLUMN IF NOT EXISTS godina_osnivanja   SMALLINT    CHECK (godina_osnivanja > 1800),
  ADD COLUMN IF NOT EXISTS datum_mandata      DATE,
  ADD COLUMN IF NOT EXISTS updated_at         TIMESTAMPTZ DEFAULT now();

COMMENT ON COLUMN klubovi.datum_mandata IS
  'Datum isteka mandata predsjednika — koristi se za generiranje upozorenja.';

-- clanovi: dodaj UUID alternativni ključ za novi API
-- (originalni numeric id ostaje — lijecnicki i rezultati imaju FK na njega)
ALTER TABLE clanovi
  ADD COLUMN IF NOT EXISTS uuid_id UUID DEFAULT gen_random_uuid() UNIQUE;

COMMENT ON COLUMN clanovi.uuid_id IS
  'UUID ključ za novi Supabase API sloj. Originalni numeric id ostaje zbog FK kompatibilnosti.';


-- ---------------------------------------------------------------------------
-- 3. NOVE TABLICE
-- ---------------------------------------------------------------------------

-- 3.1 profili — proširenje auth.users (Supabase Auth)
CREATE TABLE IF NOT EXISTS profili (
  id          UUID              PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  klub_id     UUID              REFERENCES klubovi(id) ON DELETE SET NULL,
  puno_ime    TEXT,
  uloga       uloga_korisnika   NOT NULL DEFAULT 'tajnik',
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ       NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ       NOT NULL DEFAULT now()
);
COMMENT ON TABLE profili IS
  'Profili korisnika vezani uz Supabase Auth. Jedan zapis po korisniku.';

-- 3.2 sjednice — skupštine i formalni sastanci kluba
CREATE TABLE IF NOT EXISTS sjednice (
  id            UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  klub_id       UUID            NOT NULL REFERENCES klubovi(id) ON DELETE CASCADE,
  vrsta         vrsta_sjednice  NOT NULL DEFAULT 'redovna',
  zakazano_za   TIMESTAMPTZ     NOT NULL,
  lokacija      TEXT            NOT NULL,
  status        status_sjednice NOT NULL DEFAULT 'planirana',
  napomena      TEXT,
  kreirao       UUID            REFERENCES profili(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ     NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ     NOT NULL DEFAULT now()
);
COMMENT ON TABLE sjednice IS
  'Skupštine i formalni sastanci kluba. Točke dnevnog reda u tocke_dnevnog_reda.';

-- 3.3 tocke_dnevnog_reda — normalizirana zamjena za agenda[]
CREATE TABLE IF NOT EXISTS tocke_dnevnog_reda (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  sjednica_id   UUID        NOT NULL REFERENCES sjednice(id) ON DELETE CASCADE,
  redni_broj    SMALLINT    NOT NULL CHECK (redni_broj >= 1),
  tekst         TEXT        NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (sjednica_id, redni_broj)
);
COMMENT ON TABLE tocke_dnevnog_reda IS
  'Točke dnevnog reda za sjednicu, poredane po rednom_broju.';

-- 3.4 sudionici_sjednice — normalizirana zamjena za attendees[]
CREATE TABLE IF NOT EXISTS sudionici_sjednice (
  sjednica_id   UUID        NOT NULL REFERENCES sjednice(id) ON DELETE CASCADE,
  profil_id     UUID        NOT NULL REFERENCES profili(id) ON DELETE CASCADE,
  potvrdjeno_u  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (sjednica_id, profil_id)
);
COMMENT ON TABLE sudionici_sjednice IS
  'Koji su korisnici sudjelovali na kojoj sjednici.';

-- 3.5 dokumenti — službeni dokumenti kluba (zapisnici, odluke, izvještaji)
CREATE TABLE IF NOT EXISTS dokumenti (
  id            UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  klub_id       UUID              NOT NULL REFERENCES klubovi(id) ON DELETE CASCADE,
  sjednica_id   UUID              REFERENCES sjednice(id) ON DELETE SET NULL,
  vrsta         vrsta_dokumenta   NOT NULL,
  naziv         TEXT              NOT NULL,
  status        status_dokumenta  NOT NULL DEFAULT 'nacrt',
  sadrzaj       TEXT,
  autor_id      UUID              REFERENCES profili(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ       NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ       NOT NULL DEFAULT now()
);
COMMENT ON TABLE dokumenti IS
  'Svi službeni dokumenti kluba. sadrzaj može biti AI-generirani tekst.';

-- 3.6 natjecanja — strukturirani zapisi natjecanja
CREATE TABLE IF NOT EXISTS natjecanja (
  id          UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
  klub_id     UUID                NOT NULL REFERENCES klubovi(id) ON DELETE CASCADE,
  naziv       TEXT                NOT NULL,
  datum       DATE                NOT NULL,
  lokacija    TEXT                NOT NULL,
  vrsta       vrsta_natjecanja    NOT NULL,
  razina      razina_natjecanja   NOT NULL,
  created_at  TIMESTAMPTZ         NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ         NOT NULL DEFAULT now()
);
COMMENT ON TABLE natjecanja IS
  'Natjecanja na kojima su sudjelovali članovi kluba.';

-- 3.7 rezultati_natjecanja — rezultati po članu po natjecanju
CREATE TABLE IF NOT EXISTS rezultati_natjecanja (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  natjecanje_id   UUID          NOT NULL REFERENCES natjecanja(id) ON DELETE CASCADE,
  clan_uuid       UUID          NOT NULL REFERENCES clanovi(uuid_id) ON DELETE CASCADE,
  kategorija      TEXT          NOT NULL,   -- npr. "Junior muški do 68 kg"
  disciplina      TEXT          NOT NULL,   -- 'Kumite' | 'Kata'
  plasman         SMALLINT      NOT NULL CHECK (plasman > 0),
  medalja         vrsta_medalje,            -- NULL ako plasman > 3
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE (natjecanje_id, clan_uuid, disciplina)
);
COMMENT ON TABLE rezultati_natjecanja IS
  'Rezultati po članu. Ime člana dohvaća se JOIN-om s tablicom clanovi.';

-- 3.8 dnevnik_aktivnosti — nepromjenjivi revizijski trag
CREATE TABLE IF NOT EXISTS dnevnik_aktivnosti (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  klub_id         UUID        NOT NULL REFERENCES klubovi(id) ON DELETE CASCADE,
  korisnik_id     UUID        REFERENCES profili(id) ON DELETE SET NULL,
  radnja          TEXT        NOT NULL,
  vrsta_entiteta  TEXT        NOT NULL,   -- 'Clan' | 'Sjednica' | 'Dokument' | 'Natjecanje'
  entitet_id      UUID,                   -- bez FK — entitet može biti obrisan
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE dnevnik_aktivnosti IS
  'Append-only revizijski trag svih radnji. Nikad UPDATE ili DELETE.';


-- ---------------------------------------------------------------------------
-- 4. INDEKSI
-- ---------------------------------------------------------------------------

-- clanovi
CREATE INDEX IF NOT EXISTS idx_clanovi_klub_id      ON clanovi (klub_id);
CREATE INDEX IF NOT EXISTS idx_clanovi_klub_status  ON clanovi (klub_id, status);
CREATE INDEX IF NOT EXISTS idx_clanovi_uuid_id      ON clanovi (uuid_id);
CREATE INDEX IF NOT EXISTS idx_clanovi_ime_trgm     ON clanovi
  USING gin ((ime || ' ' || prezime) gin_trgm_ops);

-- lijecnicki (ključni za računanje upozorenja)
CREATE INDEX IF NOT EXISTS idx_lijecnicki_clan_id   ON lijecnicki (clan_id);
CREATE INDEX IF NOT EXISTS idx_lijecnicki_vrijedi   ON lijecnicki (klub_id, vrijedi);

-- sjednice
CREATE INDEX IF NOT EXISTS idx_sjednice_klub_id     ON sjednice (klub_id);
CREATE INDEX IF NOT EXISTS idx_sjednice_zakazano    ON sjednice (klub_id, zakazano_za);
CREATE INDEX IF NOT EXISTS idx_sjednice_status      ON sjednice (klub_id, status);

-- dokumenti
CREATE INDEX IF NOT EXISTS idx_dokumenti_klub_id   ON dokumenti (klub_id);
CREATE INDEX IF NOT EXISTS idx_dokumenti_status    ON dokumenti (klub_id, status);
CREATE INDEX IF NOT EXISTS idx_dokumenti_sjednica  ON dokumenti (sjednica_id);

-- natjecanja
CREATE INDEX IF NOT EXISTS idx_natjecanja_klub_id  ON natjecanja (klub_id);
CREATE INDEX IF NOT EXISTS idx_natjecanja_datum    ON natjecanja (klub_id, datum DESC);

-- rezultati_natjecanja
CREATE INDEX IF NOT EXISTS idx_rezult_natjecanje   ON rezultati_natjecanja (natjecanje_id);
CREATE INDEX IF NOT EXISTS idx_rezult_clan         ON rezultati_natjecanja (clan_uuid);

-- kalendar (postojeći)
CREATE INDEX IF NOT EXISTS idx_kalendar_klub_datum ON kalendar (klub_id, datum);

-- dnevnik_aktivnosti
CREATE INDEX IF NOT EXISTS idx_dnevnik_klub_datum  ON dnevnik_aktivnosti (klub_id, created_at DESC);


-- ---------------------------------------------------------------------------
-- 5. OKIDAČ: automatsko postavljanje updated_at
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION postavi_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_klubovi_updated_at
  BEFORE UPDATE ON klubovi     FOR EACH ROW EXECUTE FUNCTION postavi_updated_at();
CREATE TRIGGER trg_profili_updated_at
  BEFORE UPDATE ON profili     FOR EACH ROW EXECUTE FUNCTION postavi_updated_at();
CREATE TRIGGER trg_sjednice_updated_at
  BEFORE UPDATE ON sjednice    FOR EACH ROW EXECUTE FUNCTION postavi_updated_at();
CREATE TRIGGER trg_dokumenti_updated_at
  BEFORE UPDATE ON dokumenti   FOR EACH ROW EXECUTE FUNCTION postavi_updated_at();
CREATE TRIGGER trg_natjecanja_updated_at
  BEFORE UPDATE ON natjecanja  FOR EACH ROW EXECUTE FUNCTION postavi_updated_at();


-- ---------------------------------------------------------------------------
-- 6. OKIDAČ: automatski kreiraj profil pri Supabase Auth registraciji
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION kreiraj_profil_za_novog_korisnika()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO profili (id, puno_ime)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'puno_ime', NEW.email)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION kreiraj_profil_za_novog_korisnika();


-- ---------------------------------------------------------------------------
-- 7. POMOĆNA FUNKCIJA: dohvati klub_id prijavljenog korisnika
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION dohvati_moj_klub_id()
RETURNS UUID LANGUAGE SQL STABLE
SECURITY DEFINER SET search_path = public AS $$
  SELECT klub_id FROM profili WHERE id = auth.uid();
$$;


-- ---------------------------------------------------------------------------
-- 8. ROW LEVEL SECURITY — SVE TABLICE (26 ukupno)
-- ---------------------------------------------------------------------------

-- ── Postojeće tablice (18) ────────────────────────────────────────────────
ALTER TABLE klubovi        ENABLE ROW LEVEL SECURITY;
ALTER TABLE korisnici      ENABLE ROW LEVEL SECURITY;
ALTER TABLE clanovi        ENABLE ROW LEVEL SECURITY;
ALTER TABLE lijecnicki     ENABLE ROW LEVEL SECURITY;
ALTER TABLE treneri        ENABLE ROW LEVEL SECURITY;
ALTER TABLE odluke         ENABLE ROW LEVEL SECURITY;
ALTER TABLE izvjestaji     ENABLE ROW LEVEL SECURITY;
ALTER TABLE financije      ENABLE ROW LEVEL SECURITY;
ALTER TABLE treninzi       ENABLE ROW LEVEL SECURITY;
ALTER TABLE kalendar       ENABLE ROW LEVEL SECURITY;
ALTER TABLE putni_nalozi   ENABLE ROW LEVEL SECURITY;
ALTER TABLE rezultati      ENABLE ROW LEVEL SECURITY;
ALTER TABLE obavijesti     ENABLE ROW LEVEL SECURITY;
ALTER TABLE planovi        ENABLE ROW LEVEL SECURITY;
ALTER TABLE aktivnosti     ENABLE ROW LEVEL SECURITY;
ALTER TABLE izjave         ENABLE ROW LEVEL SECURITY;
ALTER TABLE prijave_log    ENABLE ROW LEVEL SECURITY;
ALTER TABLE super_admini   ENABLE ROW LEVEL SECURITY;

-- ── Nove tablice (8) ──────────────────────────────────────────────────────
ALTER TABLE profili                ENABLE ROW LEVEL SECURITY;
ALTER TABLE sjednice               ENABLE ROW LEVEL SECURITY;
ALTER TABLE tocke_dnevnog_reda     ENABLE ROW LEVEL SECURITY;
ALTER TABLE sudionici_sjednice     ENABLE ROW LEVEL SECURITY;
ALTER TABLE dokumenti              ENABLE ROW LEVEL SECURITY;
ALTER TABLE natjecanja             ENABLE ROW LEVEL SECURITY;
ALTER TABLE rezultati_natjecanja   ENABLE ROW LEVEL SECURITY;
ALTER TABLE dnevnik_aktivnosti     ENABLE ROW LEVEL SECURITY;

-- ── Politike: klubovi ─────────────────────────────────────────────────────
CREATE POLICY "klubovi_citaj" ON klubovi
  FOR SELECT USING (id = dohvati_moj_klub_id());
CREATE POLICY "klubovi_uredi" ON klubovi
  FOR UPDATE USING (id = dohvati_moj_klub_id())
  WITH CHECK (id = dohvati_moj_klub_id());

-- ── Politike: tablice s klub_id (standardni obrazac) ─────────────────────
CREATE POLICY "clanovi_citaj"    ON clanovi    FOR SELECT USING (klub_id = dohvati_moj_klub_id());
CREATE POLICY "clanovi_dodaj"    ON clanovi    FOR INSERT WITH CHECK (klub_id = dohvati_moj_klub_id());
CREATE POLICY "clanovi_uredi"    ON clanovi    FOR UPDATE USING (klub_id = dohvati_moj_klub_id()) WITH CHECK (klub_id = dohvati_moj_klub_id());
CREATE POLICY "clanovi_obrisi"   ON clanovi    FOR DELETE USING (klub_id = dohvati_moj_klub_id());

CREATE POLICY "korisnici_citaj"  ON korisnici  FOR SELECT USING (klub_id = dohvati_moj_klub_id());
CREATE POLICY "korisnici_dodaj"  ON korisnici  FOR INSERT WITH CHECK (klub_id = dohvati_moj_klub_id());
CREATE POLICY "korisnici_uredi"  ON korisnici  FOR UPDATE USING (klub_id = dohvati_moj_klub_id()) WITH CHECK (klub_id = dohvati_moj_klub_id());
CREATE POLICY "korisnici_obrisi" ON korisnici  FOR DELETE USING (klub_id = dohvati_moj_klub_id());

CREATE POLICY "lijecnicki_citaj"  ON lijecnicki FOR SELECT USING (klub_id = dohvati_moj_klub_id());
CREATE POLICY "lijecnicki_dodaj"  ON lijecnicki FOR INSERT WITH CHECK (klub_id = dohvati_moj_klub_id());
CREATE POLICY "lijecnicki_uredi"  ON lijecnicki FOR UPDATE USING (klub_id = dohvati_moj_klub_id()) WITH CHECK (klub_id = dohvati_moj_klub_id());
CREATE POLICY "lijecnicki_obrisi" ON lijecnicki FOR DELETE USING (klub_id = dohvati_moj_klub_id());

CREATE POLICY "treneri_citaj"    ON treneri    FOR SELECT USING (klub_id = dohvati_moj_klub_id());
CREATE POLICY "treneri_dodaj"    ON treneri    FOR INSERT WITH CHECK (klub_id = dohvati_moj_klub_id());
CREATE POLICY "treneri_uredi"    ON treneri    FOR UPDATE USING (klub_id = dohvati_moj_klub_id()) WITH CHECK (klub_id = dohvati_moj_klub_id());
CREATE POLICY "treneri_obrisi"   ON treneri    FOR DELETE USING (klub_id = dohvati_moj_klub_id());

CREATE POLICY "odluke_citaj"     ON odluke     FOR SELECT USING (klub_id = dohvati_moj_klub_id());
CREATE POLICY "odluke_dodaj"     ON odluke     FOR INSERT WITH CHECK (klub_id = dohvati_moj_klub_id());
CREATE POLICY "odluke_uredi"     ON odluke     FOR UPDATE USING (klub_id = dohvati_moj_klub_id()) WITH CHECK (klub_id = dohvati_moj_klub_id());
CREATE POLICY "odluke_obrisi"    ON odluke     FOR DELETE USING (klub_id = dohvati_moj_klub_id());

CREATE POLICY "izvjestaji_citaj"  ON izvjestaji FOR SELECT USING (klub_id = dohvati_moj_klub_id());
CREATE POLICY "izvjestaji_dodaj"  ON izvjestaji FOR INSERT WITH CHECK (klub_id = dohvati_moj_klub_id());
CREATE POLICY "izvjestaji_uredi"  ON izvjestaji FOR UPDATE USING (klub_id = dohvati_moj_klub_id()) WITH CHECK (klub_id = dohvati_moj_klub_id());
CREATE POLICY "izvjestaji_obrisi" ON izvjestaji FOR DELETE USING (klub_id = dohvati_moj_klub_id());

CREATE POLICY "financije_citaj"  ON financije  FOR SELECT USING (klub_id = dohvati_moj_klub_id());
CREATE POLICY "financije_dodaj"  ON financije  FOR INSERT WITH CHECK (klub_id = dohvati_moj_klub_id());
CREATE POLICY "financije_uredi"  ON financije  FOR UPDATE USING (klub_id = dohvati_moj_klub_id()) WITH CHECK (klub_id = dohvati_moj_klub_id());
CREATE POLICY "financije_obrisi" ON financije  FOR DELETE USING (klub_id = dohvati_moj_klub_id());

CREATE POLICY "treninzi_citaj"   ON treninzi   FOR SELECT USING (klub_id = dohvati_moj_klub_id());
CREATE POLICY "treninzi_dodaj"   ON treninzi   FOR INSERT WITH CHECK (klub_id = dohvati_moj_klub_id());
CREATE POLICY "treninzi_uredi"   ON treninzi   FOR UPDATE USING (klub_id = dohvati_moj_klub_id()) WITH CHECK (klub_id = dohvati_moj_klub_id());
CREATE POLICY "treninzi_obrisi"  ON treninzi   FOR DELETE USING (klub_id = dohvati_moj_klub_id());

CREATE POLICY "kalendar_citaj"   ON kalendar   FOR SELECT USING (klub_id = dohvati_moj_klub_id());
CREATE POLICY "kalendar_dodaj"   ON kalendar   FOR INSERT WITH CHECK (klub_id = dohvati_moj_klub_id());
CREATE POLICY "kalendar_uredi"   ON kalendar   FOR UPDATE USING (klub_id = dohvati_moj_klub_id()) WITH CHECK (klub_id = dohvati_moj_klub_id());
CREATE POLICY "kalendar_obrisi"  ON kalendar   FOR DELETE USING (klub_id = dohvati_moj_klub_id());

CREATE POLICY "putni_nalozi_citaj"  ON putni_nalozi FOR SELECT USING (klub_id = dohvati_moj_klub_id());
CREATE POLICY "putni_nalozi_dodaj"  ON putni_nalozi FOR INSERT WITH CHECK (klub_id = dohvati_moj_klub_id());
CREATE POLICY "putni_nalozi_uredi"  ON putni_nalozi FOR UPDATE USING (klub_id = dohvati_moj_klub_id()) WITH CHECK (klub_id = dohvati_moj_klub_id());
CREATE POLICY "putni_nalozi_obrisi" ON putni_nalozi FOR DELETE USING (klub_id = dohvati_moj_klub_id());

CREATE POLICY "rezultati_citaj"  ON rezultati  FOR SELECT USING (klub_id = dohvati_moj_klub_id());
CREATE POLICY "rezultati_dodaj"  ON rezultati  FOR INSERT WITH CHECK (klub_id = dohvati_moj_klub_id());
CREATE POLICY "rezultati_uredi"  ON rezultati  FOR UPDATE USING (klub_id = dohvati_moj_klub_id()) WITH CHECK (klub_id = dohvati_moj_klub_id());
CREATE POLICY "rezultati_obrisi" ON rezultati  FOR DELETE USING (klub_id = dohvati_moj_klub_id());

CREATE POLICY "obavijesti_citaj"  ON obavijesti FOR SELECT USING (klub_id = dohvati_moj_klub_id());
CREATE POLICY "obavijesti_dodaj"  ON obavijesti FOR INSERT WITH CHECK (klub_id = dohvati_moj_klub_id());
CREATE POLICY "obavijesti_uredi"  ON obavijesti FOR UPDATE USING (klub_id = dohvati_moj_klub_id()) WITH CHECK (klub_id = dohvati_moj_klub_id());
CREATE POLICY "obavijesti_obrisi" ON obavijesti FOR DELETE USING (klub_id = dohvati_moj_klub_id());

CREATE POLICY "planovi_citaj"    ON planovi    FOR SELECT USING (klub_id = dohvati_moj_klub_id());
CREATE POLICY "planovi_dodaj"    ON planovi    FOR INSERT WITH CHECK (klub_id = dohvati_moj_klub_id());
CREATE POLICY "planovi_uredi"    ON planovi    FOR UPDATE USING (klub_id = dohvati_moj_klub_id()) WITH CHECK (klub_id = dohvati_moj_klub_id());
CREATE POLICY "planovi_obrisi"   ON planovi    FOR DELETE USING (klub_id = dohvati_moj_klub_id());

CREATE POLICY "aktivnosti_citaj"  ON aktivnosti FOR SELECT USING (klub_id = dohvati_moj_klub_id());
CREATE POLICY "aktivnosti_dodaj"  ON aktivnosti FOR INSERT WITH CHECK (klub_id = dohvati_moj_klub_id());
CREATE POLICY "aktivnosti_uredi"  ON aktivnosti FOR UPDATE USING (klub_id = dohvati_moj_klub_id()) WITH CHECK (klub_id = dohvati_moj_klub_id());
CREATE POLICY "aktivnosti_obrisi" ON aktivnosti FOR DELETE USING (klub_id = dohvati_moj_klub_id());

CREATE POLICY "izjave_citaj"     ON izjave     FOR SELECT USING (klub_id = dohvati_moj_klub_id());
CREATE POLICY "izjave_dodaj"     ON izjave     FOR INSERT WITH CHECK (klub_id = dohvati_moj_klub_id());
CREATE POLICY "izjave_uredi"     ON izjave     FOR UPDATE USING (klub_id = dohvati_moj_klub_id()) WITH CHECK (klub_id = dohvati_moj_klub_id());
CREATE POLICY "izjave_obrisi"    ON izjave     FOR DELETE USING (klub_id = dohvati_moj_klub_id());

CREATE POLICY "prijave_log_citaj" ON prijave_log FOR SELECT USING (klub_id = dohvati_moj_klub_id());
CREATE POLICY "prijave_log_dodaj" ON prijave_log FOR INSERT WITH CHECK (klub_id = dohvati_moj_klub_id());

-- super_admini: nema klub_id — blokirano za sve osim service_role (koji uvijek zaobilazi RLS)
CREATE POLICY "super_admini_zabrana" ON super_admini FOR ALL USING (false);

-- ── Politike: profili ─────────────────────────────────────────────────────
CREATE POLICY "profili_vlastiti_citaj" ON profili
  FOR SELECT USING (id = auth.uid() OR klub_id = dohvati_moj_klub_id());
CREATE POLICY "profili_vlastiti_uredi" ON profili
  FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- ── Politike: nove tablice s klub_id ─────────────────────────────────────
CREATE POLICY "sjednice_citaj"   ON sjednice   FOR SELECT USING (klub_id = dohvati_moj_klub_id());
CREATE POLICY "sjednice_dodaj"   ON sjednice   FOR INSERT WITH CHECK (klub_id = dohvati_moj_klub_id());
CREATE POLICY "sjednice_uredi"   ON sjednice   FOR UPDATE USING (klub_id = dohvati_moj_klub_id()) WITH CHECK (klub_id = dohvati_moj_klub_id());
CREATE POLICY "sjednice_obrisi"  ON sjednice   FOR DELETE USING (klub_id = dohvati_moj_klub_id());

CREATE POLICY "dokumenti_citaj"  ON dokumenti  FOR SELECT USING (klub_id = dohvati_moj_klub_id());
CREATE POLICY "dokumenti_dodaj"  ON dokumenti  FOR INSERT WITH CHECK (klub_id = dohvati_moj_klub_id());
CREATE POLICY "dokumenti_uredi"  ON dokumenti  FOR UPDATE USING (klub_id = dohvati_moj_klub_id()) WITH CHECK (klub_id = dohvati_moj_klub_id());
CREATE POLICY "dokumenti_obrisi" ON dokumenti  FOR DELETE USING (klub_id = dohvati_moj_klub_id());

CREATE POLICY "natjecanja_citaj"  ON natjecanja FOR SELECT USING (klub_id = dohvati_moj_klub_id());
CREATE POLICY "natjecanja_dodaj"  ON natjecanja FOR INSERT WITH CHECK (klub_id = dohvati_moj_klub_id());
CREATE POLICY "natjecanja_uredi"  ON natjecanja FOR UPDATE USING (klub_id = dohvati_moj_klub_id()) WITH CHECK (klub_id = dohvati_moj_klub_id());
CREATE POLICY "natjecanja_obrisi" ON natjecanja FOR DELETE USING (klub_id = dohvati_moj_klub_id());

CREATE POLICY "dnevnik_citaj"    ON dnevnik_aktivnosti FOR SELECT USING (klub_id = dohvati_moj_klub_id());
CREATE POLICY "dnevnik_dodaj"    ON dnevnik_aktivnosti FOR INSERT WITH CHECK (klub_id = dohvati_moj_klub_id());

-- ── Politike: tablice bez direktnog klub_id (nasljeđuju sigurnost JOIN-om) ─
CREATE POLICY "tocke_citaj"  ON tocke_dnevnog_reda FOR SELECT
  USING (sjednica_id IN (SELECT id FROM sjednice WHERE klub_id = dohvati_moj_klub_id()));
CREATE POLICY "tocke_dodaj"  ON tocke_dnevnog_reda FOR INSERT
  WITH CHECK (sjednica_id IN (SELECT id FROM sjednice WHERE klub_id = dohvati_moj_klub_id()));
CREATE POLICY "tocke_uredi"  ON tocke_dnevnog_reda FOR UPDATE
  USING (sjednica_id IN (SELECT id FROM sjednice WHERE klub_id = dohvati_moj_klub_id()));
CREATE POLICY "tocke_obrisi" ON tocke_dnevnog_reda FOR DELETE
  USING (sjednica_id IN (SELECT id FROM sjednice WHERE klub_id = dohvati_moj_klub_id()));

CREATE POLICY "sudionici_citaj"  ON sudionici_sjednice FOR SELECT
  USING (sjednica_id IN (SELECT id FROM sjednice WHERE klub_id = dohvati_moj_klub_id()));
CREATE POLICY "sudionici_dodaj"  ON sudionici_sjednice FOR INSERT
  WITH CHECK (sjednica_id IN (SELECT id FROM sjednice WHERE klub_id = dohvati_moj_klub_id()));
CREATE POLICY "sudionici_obrisi" ON sudionici_sjednice FOR DELETE
  USING (sjednica_id IN (SELECT id FROM sjednice WHERE klub_id = dohvati_moj_klub_id()));

CREATE POLICY "rezult_citaj"  ON rezultati_natjecanja FOR SELECT
  USING (natjecanje_id IN (SELECT id FROM natjecanja WHERE klub_id = dohvati_moj_klub_id()));
CREATE POLICY "rezult_dodaj"  ON rezultati_natjecanja FOR INSERT
  WITH CHECK (natjecanje_id IN (SELECT id FROM natjecanja WHERE klub_id = dohvati_moj_klub_id()));
CREATE POLICY "rezult_uredi"  ON rezultati_natjecanja FOR UPDATE
  USING (natjecanje_id IN (SELECT id FROM natjecanja WHERE klub_id = dohvati_moj_klub_id()));
CREATE POLICY "rezult_obrisi" ON rezultati_natjecanja FOR DELETE
  USING (natjecanje_id IN (SELECT id FROM natjecanja WHERE klub_id = dohvati_moj_klub_id()));


-- ---------------------------------------------------------------------------
-- 9. POGLED: upozorenja
-- Dinamički izračunata upozorenja — zamjena za hardkodirani niz u mock-data.ts
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW upozorenja AS

-- Istek mandata predsjednika (unutar 90 dana)
SELECT
  k.id                                                  AS klub_id,
  'istek_mandata'                                       AS kljuc,
  CASE WHEN (k.datum_mandata - CURRENT_DATE) <= 30
       THEN 'kriticno' ELSE 'upozorenje' END            AS ozbiljnost,
  'Istek mandata predsjednika'                          AS naslov,
  'Mandat predsjednika ' || k.predsjednik ||
    ' ističe za ' || (k.datum_mandata - CURRENT_DATE)::TEXT ||
    ' dana (' || to_char(k.datum_mandata, 'DD.MM.YYYY.') || ').'
                                                        AS opis,
  NULL::INTEGER                                         AS broj,
  '/skupstine'                                          AS url_akcije
FROM klubovi k
WHERE k.datum_mandata IS NOT NULL
  AND (k.datum_mandata - CURRENT_DATE) BETWEEN 0 AND 90

UNION ALL

-- Istekli liječnički pregledi (zadnji pregled po članu)
SELECT
  c.klub_id,
  'istekao_lijecnicki',
  'upozorenje',
  'Istekli liječnički pregledi',
  count(*)::TEXT || ' član(ova) ima istekle liječničke preglede i ne može natjecati.',
  count(*)::INTEGER,
  '/clanovi'
FROM clanovi c
JOIN LATERAL (
  SELECT vrijedi
  FROM lijecnicki
  WHERE clan_id = c.id
  ORDER BY datum DESC NULLS LAST
  LIMIT 1
) zadnji ON zadnji.vrijedi < CURRENT_DATE
WHERE c.status = 'aktivan'
GROUP BY c.klub_id
HAVING count(*) > 0

UNION ALL

-- Liječnički uskoro ističe (unutar 60 dana)
SELECT
  c.klub_id,
  'lijecnicki_uskoro',
  'info',
  'Liječnički pregled uskoro ističe',
  count(*)::TEXT || ' član(ova) ima liječnički koji ističe u idućih 60 dana.',
  count(*)::INTEGER,
  '/clanovi'
FROM clanovi c
JOIN LATERAL (
  SELECT vrijedi
  FROM lijecnicki
  WHERE clan_id = c.id
  ORDER BY datum DESC NULLS LAST
  LIMIT 1
) zadnji ON zadnji.vrijedi BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '60 days'
WHERE c.status = 'aktivan'
GROUP BY c.klub_id
HAVING count(*) > 0

UNION ALL

-- Nepotpisana GDPR privola (maloljetni članovi)
SELECT
  klub_id,
  'nepotpisana_gdpr',
  'upozorenje',
  'Nepotpisane privole (GDPR)',
  count(*)::TEXT || ' maloljetnih članova nema potpisanu GDPR privolu.',
  count(*)::INTEGER,
  '/clanovi'
FROM clanovi
WHERE gdpr = 'ne'
  AND status = 'aktivan'
  AND (CURRENT_DATE - dat_rod) < 18 * 365
GROUP BY klub_id
HAVING count(*) > 0

UNION ALL

-- Predstojeće sjednice (u idućih 30 dana)
SELECT
  s.klub_id,
  'predstojeća_sjednica',
  'info',
  'Sjednica zakazana',
  initcap(s.vrsta::TEXT) || ' sjednica zakazana je za ' ||
    to_char(s.zakazano_za, 'DD.MM.YYYY. "u" HH24:MI') || 'h.',
  NULL::INTEGER,
  '/skupstine'
FROM sjednice s
WHERE s.status = 'planirana'
  AND s.zakazano_za BETWEEN now() AND now() + INTERVAL '30 days';

COMMENT ON VIEW upozorenja IS
  'Dinamički izračunata upozorenja iz živih podataka. '
  'Zamjenjuje hardkodirani niz alerts[] u lib/mock-data.ts.';
