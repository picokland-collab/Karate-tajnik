import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase-server';

/**
 * POST /api/registracija
 *
 * Kreira novi klub za prijavljenog korisnika koji još nema klub.
 * Poziva SECURITY DEFINER funkciju fn_registriraj_novi_klub() koja:
 *   1. Validira da korisnik nema klub
 *   2. Kreira zapis u tablici klubovi (paket: 'besplatno')
 *   3. Ažurira profili.klub_id i profili.uloga = 'admin'
 *   4. Bilježi u dnevnik_aktivnosti
 *
 * Nakon uspjeha, ažurira user_metadata.has_club = true kako bi
 * middleware mogao preskočiti DB provjeru na narednim zahtjevima.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: 'Niste prijavljeni.' }, { status: 401 });
  }

  let body: { naziv?: string; grad?: string; kontakt_email?: string; oib?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Neispravan JSON.' }, { status: 400 });
  }

  if (!body.naziv?.trim() || body.naziv.trim().length < 3) {
    return Response.json(
      { error: 'Naziv kluba mora imati najmanje 3 znaka.' },
      { status: 400 }
    );
  }

  const oib = body.oib?.trim() ?? '';
  if (oib && !/^\d{11}$/.test(oib)) {
    return Response.json({ error: 'OIB mora sadržavati točno 11 znamenki.' }, { status: 400 });
  }

  const { data: klub_id, error } = await supabase.rpc('fn_registriraj_novi_klub', {
    p_naziv:         body.naziv.trim(),
    p_grad:          body.grad?.trim() ?? null,
    p_kontakt_email: body.kontakt_email?.trim() ?? null,
    p_oib:           oib || null,
  });

  if (error) {
    const status = error.code === '42501' ? 401
                 : error.code === '23505' ? 409
                 : 500;
    return Response.json({ error: error.message }, { status });
  }

  // Označi u user_metadata da korisnik ima klub — middleware čita ovo iz JWT-a
  await supabase.auth.updateUser({ data: { has_club: true } });

  return Response.json({ ok: true, klub_id });
}
