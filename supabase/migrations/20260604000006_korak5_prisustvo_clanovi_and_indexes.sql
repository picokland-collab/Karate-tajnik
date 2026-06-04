-- treninzi already exists with: id TEXT, klub_id UUID, datum DATE,
-- naslov TEXT, prisutni JSONB, created_at TIMESTAMPTZ.
-- We add the relational junction table and missing index.

-- Composite index for date-range queries per club (idempotent)
CREATE INDEX IF NOT EXISTS idx_treninzi_klub_datum ON public.treninzi(klub_id, datum);

-- ── PRISUSTVO_CLANOVI JUNCTION TABLE ─────────────────────────────────────────
-- trening_id is TEXT to match the existing treninzi.id column type
CREATE TABLE public.prisustvo_clanovi (
  trening_id TEXT    NOT NULL REFERENCES public.treninzi(id) ON DELETE CASCADE,
  member_id  NUMERIC NOT NULL REFERENCES public.clanovi(id)  ON DELETE CASCADE,
  status     TEXT    NOT NULL
    CHECK (status IN ('nazocan', 'odsutan', 'opravdano')),
  PRIMARY KEY (trening_id, member_id)
);

ALTER TABLE public.prisustvo_clanovi ENABLE ROW LEVEL SECURITY;

-- RLS scoped transitively through treninzi
CREATE POLICY "prisustvo_select" ON public.prisustvo_clanovi FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.treninzi t
    WHERE t.id = trening_id AND t.klub_id = dohvati_moj_klub_id()
  ));
CREATE POLICY "prisustvo_insert" ON public.prisustvo_clanovi FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.treninzi t
    WHERE t.id = trening_id AND t.klub_id = dohvati_moj_klub_id()
  ));
CREATE POLICY "prisustvo_update" ON public.prisustvo_clanovi FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.treninzi t
    WHERE t.id = trening_id AND t.klub_id = dohvati_moj_klub_id()
  ));
CREATE POLICY "prisustvo_delete" ON public.prisustvo_clanovi FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.treninzi t
    WHERE t.id = trening_id AND t.klub_id = dohvati_moj_klub_id()
  ));

CREATE INDEX idx_prisustvo_member_id ON public.prisustvo_clanovi(member_id);
