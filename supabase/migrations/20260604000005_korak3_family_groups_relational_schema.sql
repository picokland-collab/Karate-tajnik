-- ── 1. FAMILY GROUPS TABLE ────────────────────────────────────────────────────
CREATE TABLE public.family_groups (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  klub_id     UUID        NOT NULL REFERENCES public.klubovi(id) ON DELETE CASCADE,
  family_name TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.family_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fg_select" ON public.family_groups FOR SELECT
  USING  (klub_id = dohvati_moj_klub_id());
CREATE POLICY "fg_insert" ON public.family_groups FOR INSERT
  WITH CHECK (klub_id = dohvati_moj_klub_id());
CREATE POLICY "fg_update" ON public.family_groups FOR UPDATE
  USING  (klub_id = dohvati_moj_klub_id())
  WITH CHECK (klub_id = dohvati_moj_klub_id());
CREATE POLICY "fg_delete" ON public.family_groups FOR DELETE
  USING  (klub_id = dohvati_moj_klub_id());

CREATE INDEX idx_family_groups_klub_id ON public.family_groups(klub_id);

-- ── 2. MEMBER FAMILIES JUNCTION TABLE ────────────────────────────────────────
-- member_id is NUMERIC to match clanovi.id (not UUID — clanovi uses a numeric PK)
CREATE TABLE public.member_families (
  member_id          NUMERIC  NOT NULL REFERENCES public.clanovi(id)       ON DELETE CASCADE,
  family_group_id    UUID     NOT NULL REFERENCES public.family_groups(id) ON DELETE CASCADE,
  relationship_type  TEXT     NOT NULL
    CHECK (relationship_type IN ('child', 'parent', 'guardian')),
  is_primary_contact BOOLEAN  NOT NULL DEFAULT false,
  PRIMARY KEY (member_id, family_group_id)
);

ALTER TABLE public.member_families ENABLE ROW LEVEL SECURITY;

-- RLS is scoped transitively through family_groups (no direct klub_id column)
CREATE POLICY "mf_select" ON public.member_families FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.family_groups fg
    WHERE fg.id = family_group_id AND fg.klub_id = dohvati_moj_klub_id()
  ));
CREATE POLICY "mf_insert" ON public.member_families FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.family_groups fg
    WHERE fg.id = family_group_id AND fg.klub_id = dohvati_moj_klub_id()
  ));
CREATE POLICY "mf_update" ON public.member_families FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.family_groups fg
    WHERE fg.id = family_group_id AND fg.klub_id = dohvati_moj_klub_id()
  ));
CREATE POLICY "mf_delete" ON public.member_families FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.family_groups fg
    WHERE fg.id = family_group_id AND fg.klub_id = dohvati_moj_klub_id()
  ));

CREATE INDEX idx_member_families_member_id       ON public.member_families(member_id);
CREATE INDEX idx_member_families_family_group_id ON public.member_families(family_group_id);

-- ── 3. DEPRECATE LEGACY COLUMN (DO NOT DROP) ─────────────────────────────────
COMMENT ON COLUMN public.clanovi.roditelji IS
  'DEPRECATED – Fallback for v1.0 billing. Kept in sync by trg_sync_family_to_legacy_roditelji. Do not remove until billing module is upgraded to query member_families.';

-- ── 4. BACKFILL ───────────────────────────────────────────────────────────────
DO $$
DECLARE
  r     RECORD;
  fg_id UUID;
BEGIN
  FOR r IN
    SELECT DISTINCT klub_id, trim(roditelji) AS g
    FROM  public.clanovi
    WHERE roditelji IS NOT NULL AND trim(roditelji) <> ''
  LOOP
    INSERT INTO public.family_groups (klub_id, family_name)
    VALUES (r.klub_id, 'Obitelj ' || initcap(r.g))
    ON CONFLICT DO NOTHING
    RETURNING id INTO fg_id;

    IF fg_id IS NULL THEN
      SELECT id INTO fg_id FROM public.family_groups
      WHERE klub_id = r.klub_id
        AND family_name = 'Obitelj ' || initcap(r.g);
    END IF;

    INSERT INTO public.member_families (member_id, family_group_id, relationship_type)
    SELECT id, fg_id, 'child'
    FROM   public.clanovi
    WHERE  klub_id = r.klub_id AND trim(roditelji) = r.g
    ON CONFLICT DO NOTHING;
  END LOOP;
END;
$$;

-- ── 5. SYNC TRIGGER ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION sync_family_to_legacy_roditelji()
RETURNS TRIGGER AS $$
DECLARE
  fg_name       TEXT;
  target_member NUMERIC;
BEGIN
  target_member := COALESCE(NEW.member_id, OLD.member_id);

  IF TG_OP = 'DELETE' THEN
    SELECT fg.family_name INTO fg_name
    FROM   public.member_families mf
    JOIN   public.family_groups   fg ON fg.id = mf.family_group_id
    WHERE  mf.member_id       = OLD.member_id
      AND  mf.family_group_id <> OLD.family_group_id
    ORDER BY mf.is_primary_contact DESC
    LIMIT 1;

    UPDATE public.clanovi SET roditelji = fg_name WHERE id = OLD.member_id;
    RETURN OLD;
  END IF;

  SELECT family_name INTO fg_name
  FROM   public.family_groups WHERE id = NEW.family_group_id;

  UPDATE public.clanovi SET roditelji = fg_name WHERE id = NEW.member_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_family_to_legacy_roditelji ON public.member_families;
CREATE TRIGGER trg_sync_family_to_legacy_roditelji
AFTER INSERT OR UPDATE OR DELETE ON public.member_families
FOR EACH ROW EXECUTE FUNCTION sync_family_to_legacy_roditelji();
