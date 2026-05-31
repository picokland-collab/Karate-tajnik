-- =============================================================================
-- Harden financije RLS: enforce admin role at the database level.
-- Replaces the club-only checks with club + admin-role checks so that
-- direct API access (curl, Supabase client, devtools) is also blocked
-- for non-admin users regardless of the UI layer.
-- =============================================================================

DROP POLICY IF EXISTS "financije_citaj"  ON financije;
DROP POLICY IF EXISTS "financije_dodaj"  ON financije;
DROP POLICY IF EXISTS "financije_uredi"  ON financije;
DROP POLICY IF EXISTS "financije_obrisi" ON financije;

-- SELECT: only admins in the same club may read financial records
CREATE POLICY "financije_citaj" ON financije
  FOR SELECT
  USING (
    klub_id = dohvati_moj_klub_id()
    AND (SELECT uloga FROM profili WHERE id = auth.uid()) = 'admin'
  );

-- INSERT: only admins in the same club may create records
CREATE POLICY "financije_dodaj" ON financije
  FOR INSERT
  WITH CHECK (
    klub_id = dohvati_moj_klub_id()
    AND (SELECT uloga FROM profili WHERE id = auth.uid()) = 'admin'
  );

-- UPDATE: admin check in both USING (row visibility) and WITH CHECK (new values)
CREATE POLICY "financije_uredi" ON financije
  FOR UPDATE
  USING (
    klub_id = dohvati_moj_klub_id()
    AND (SELECT uloga FROM profili WHERE id = auth.uid()) = 'admin'
  )
  WITH CHECK (
    klub_id = dohvati_moj_klub_id()
    AND (SELECT uloga FROM profili WHERE id = auth.uid()) = 'admin'
  );

-- DELETE: only admins in the same club may remove records
CREATE POLICY "financije_obrisi" ON financije
  FOR DELETE
  USING (
    klub_id = dohvati_moj_klub_id()
    AND (SELECT uloga FROM profili WHERE id = auth.uid()) = 'admin'
  );
