-- Dodaje polje za izuzeće od plaćanja članarine (Odluka Upravnog Odbora)
ALTER TABLE clanovi
  ADD COLUMN IF NOT EXISTS oslobodjen_clanarina BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN clanovi.oslobodjen_clanarina IS
  'TRUE = član je oslobođen plaćanja članarine (Odluka Upravnog Odbora)';
