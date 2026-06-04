-- Block role self-elevation via trigger
CREATE OR REPLACE FUNCTION enforce_role_immutability()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.uloga IS DISTINCT FROM OLD.uloga THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.profili
      WHERE id = auth.uid()
      AND uloga = 'admin'
    ) THEN
      RAISE EXCEPTION 'PRIVILEGE_ESCALATION_BLOCKED: Only administrators can modify user roles!';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_enforce_role_immutability ON public.profili;
CREATE TRIGGER trg_enforce_role_immutability
BEFORE UPDATE ON public.profili
FOR EACH ROW EXECUTE FUNCTION enforce_role_immutability();

-- Harden profili_uredi policy with WITH CHECK to prevent club-hopping
DROP POLICY IF EXISTS "profili_uredi" ON public.profili;
CREATE POLICY "profili_uredi" ON public.profili
FOR UPDATE
USING (id = auth.uid())
WITH CHECK (id = auth.uid() AND klub_id = dohvati_moj_klub_id());

-- Fix finance read access: tajnik/trener were blocked by the old admin-only SELECT policy
DROP POLICY IF EXISTS "financije_citaj" ON public.financije;
DROP POLICY IF EXISTS "financije_upis" ON public.financije;

CREATE POLICY "financije_citaj_klub" ON public.financije
FOR SELECT USING (klub_id = dohvati_moj_klub_id());

CREATE POLICY "financije_write_admin_only" ON public.financije
FOR ALL USING (
  klub_id = dohvati_moj_klub_id()
  AND EXISTS (SELECT 1 FROM public.profili WHERE id = auth.uid() AND uloga = 'admin')
)
WITH CHECK (
  klub_id = dohvati_moj_klub_id()
  AND EXISTS (SELECT 1 FROM public.profili WHERE id = auth.uid() AND uloga = 'admin')
);
