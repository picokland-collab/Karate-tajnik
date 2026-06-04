-- Dodaje polja potrebna za registraciju članova u HKS portal (karate.hr).
-- Sva polja su nullable — postojeći podaci nisu zahvaćeni.
ALTER TABLE clanovi
  ADD COLUMN IF NOT EXISTS oib              TEXT,
  ADD COLUMN IF NOT EXISTS spol             TEXT,
  ADD COLUMN IF NOT EXISTS mjesto_rodjenja  TEXT,
  ADD COLUMN IF NOT EXISTS drzava_rodjenja  TEXT;

COMMENT ON COLUMN clanovi.oib             IS 'OIB člana — potreban za HKS registraciju';
COMMENT ON COLUMN clanovi.spol            IS 'Spol: M ili Ž — potreban za HKS registraciju';
COMMENT ON COLUMN clanovi.mjesto_rodjenja IS 'Mjesto rođenja — potreban za HKS registraciju';
COMMENT ON COLUMN clanovi.drzava_rodjenja IS 'Država rođenja — potreban za HKS registraciju (default: Hrvatska)';
