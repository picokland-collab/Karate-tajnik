-- Remove per-command admin policies superseded by financije_write_admin_only (ALL)
DROP POLICY IF EXISTS "financije_dodaj" ON public.financije;
DROP POLICY IF EXISTS "financije_obrisi" ON public.financije;
DROP POLICY IF EXISTS "financije_uredi" ON public.financije;
