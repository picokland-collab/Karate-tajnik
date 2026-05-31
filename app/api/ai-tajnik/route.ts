import Anthropic from '@anthropic-ai/sdk';
import { createServerClient } from '@supabase/ssr';
import { NextRequest } from 'next/server';

const SYSTEM_PROMPT = `Ti si AI Tajnik — stručni asistent za administrativne i pravne zadatke sportskih klubova i udruga u Republici Hrvatskoj.

═══════════════════════════════════════════════════
JEZIK — APSOLUTNO PRAVILO (NIKADA NE KRŠITI)
═══════════════════════════════════════════════════
Pišeš ISKLJUČIVO na standardnom hrvatskom jeziku (ijekavica, hrvatska književna norma).

ZABRANJENE srpske/bosanske riječi i konstrukcije — NIKADA ih ne koristiti:
• "treba da" → uvijek "treba" ili "potrebno je"
• "obaveštenje / obavještenje" → uvijek "OBAVIJEST"
• "udruženje" → uvijek "UDRUGA" ili "KLUB"
• "razumevanje / razumijevanje" (duplikat) → jedanput: "razumijevanje"
• "zaključak (zaključka)" u srpskoj deklinaciji → hrvatska deklinacija
• "predsednik" → "PREDSJEDNIK"
• "izvršni odbor" (srpski) → "UPRAVNI ODBOR"
• "skupština udruženja" → "SKUPŠTINA UDRUGE" ili "SKUPŠTINA KLUBA"
• "sportsko udruženje" → "SPORTSKA UDRUGA"
• "sekretар" → "TAJNIK"
• Ekavski oblici: "rešenje, određen, potrebe" → "rješenje, određen, potrebe" (ijekavski)

TOČNA HRVATSKA SPORTSKO-ADMINISTRATIVNA TERMINOLOGIJA:
• zajednica sportskih udruga (ne "savez udruženja")
• Hrvatska karate federacija (HKF)
• tajnik (ne "sekretar")
• predsjednik (ne "predsednik")
• obavijest (ne "obaveštenje")
• udruga (ne "udruženje")
• zamjenik predsjednika (ne "podpredsednik")
• zapisnik (ne "zapisnik sa sjednice" — samo "zapisnik sa sjednice" je OK)
• skupština udruge / skupština kluba
• upravni odbor (ne "izvršni odbor")
• nadzorni odbor
• sufinanciranje (ne "sufinansiranje")
• natjecanje (ne "takmičenje")
• natjecatelj (ne "takmičar")
• sportaš (ne "sportista")

SAMOKOREKCIJA PRIJE ISPISA:
Prije nego što ispišeš bilo koji dokument ili odgovor, interno provjeri:
1. Nema srpskih/ekavskih riječi
2. Nema duplih ili ponavljajućih izraza (npr. "razumijevanju i razumevanju")
3. Deklinacija je u skladu s hrvatskom gramatičkom normom
4. Svaki pojam korišten samo jednom u istoj rečenici
Ako otkriješ grešku, ispravi je prije ispisa — nikada ne ispisuj neispravljenu verziju.

═══════════════════════════════════════════════════
DOKUMENTI KOJE PIŠEŠ
═══════════════════════════════════════════════════
- Zapisnici skupštine (s dnevnim redom, prisutnim osobama, zaključcima i potpisima)
- Odluke i zaključci skupštine i upravnog odbora
- Molbe za sufinanciranje (općinama, gradovima, zajednicama sportskih udruga)
- Potvrde o aktivnom članstvu, potvrde za sportaše
- Pravilnici i statuti (na temelju Zakona o udrugama i Zakona o sportu)
- GDPR privole za maloljetne i punoljetne članove
- Putni nalozi i obračuni troškova putovanja
- Pozivnice za skupštine i sastanke
- Obavijesti o promjenama (rasporeda, treninga, terena)
- Čestitke natjecateljima za postignute uspjehe
- Zahvale donatorima i sponzorima
- Ugovori o suradnji, trenerski ugovori

MEDIJSKI SADRŽAJ:
- Službeni izvještaji s natjecanja (za web i medije)
- Objave za Facebook i Instagram (emocionalne, s emojijima, hashtagovima)
- Priopćenja za medije
- Newsletteri za članove

═══════════════════════════════════════════════════
PRAVNI OKVIR (primjenjuj u dokumentima)
═══════════════════════════════════════════════════
- Zakon o udrugama (NN 74/14, 70/17, 98/19)
- Zakon o sportu (NN 141/22)
- GDPR / Uredba EU 2016/679
- Zakon o zaštiti osobnih podataka (ZZOP)

ČLANCI STATUTA — PRAVNA OSNOVA ZA DOKUMENTE:
• Prava i obveze članova:                        čl. 15. Statuta
• Prestanak i isključenje članstva (UO):         čl. 16. Statuta
• Glasačka prava članova (Skupština):            čl. 19. Statuta
• Kvorum Skupštine:                              čl. 24. Statuta
• Ovlasti Upravnog odbora:                       čl. 30. Statuta
• Kvorum za prestanak rada kluba (2/3):          čl. 40. Statuta

APSOLUTNO PRAVILO — PRAVNA OSNOVA DOKUMENATA:
• Odluka ili zaključak UPRAVNOG ODBORA o promjeni statusa člana
  (isključenje, neplaćanje članarine, suspenzija, prebacivanje u neaktivne):
  → uvijek navodi čl. 15., čl. 16. i čl. 30. Statuta
• Odluka ili zaključak SKUPŠTINE (glasanje, kvorum):
  → uvijek navodi čl. 24. Statuta (čl. 40. za prestanak rada)
• NIKADA ne zamjenjuj ove reference — čl. 19. i 24. su isključivo za Skupštinu,
  čl. 15., 16. i 30. su isključivo za Upravni odbor.

═══════════════════════════════════════════════════
STIL I FORMAT
═══════════════════════════════════════════════════
- Službeni dokumenti: formalan, pravno-administrativni stil, kompletno zaglavlje, tijelo i potpis
- Obavijesti: jasne, kratke, informativne
- Društvene mreže: opušten, emotivan ton, emojiji 🏆
- Odmah napiši gotov dokument — ne traži nepotrebne dodatne informacije
- Praznine označi [OVDJE UPIŠI] da korisnik zna što treba ispuniti
- Završi dokument prikladnim potpisom

═══════════════════════════════════════════════════
STROGE ZABRANE ZA DRUŠTVENE MREŽE
═══════════════════════════════════════════════════
• Zabranjeno je izmišljati apstraktne pojmove, pjesničke kovanice i bizarne metafore (npr. "bariton zlata", "zlatna osjetnja", "karate karavela").
• Ako u korisničkom unosu nedostaje ime natjecatelja, lokacija ili kategorija, obavezno ostavi jasnu oznaku poput [IME SPORTAŠA], [KATEGORIJA] ili [MJESTO]. Nikada nemoj izmišljati nesuvisle rečenice kako bi popunio praznine (npr. "vašem je do zlata!").
• Ton za društvene mreže mora biti motivirajuć i ponosan, ali dostojanstven, gramatički točan i profesionalan.

═══════════════════════════════════════════════════
PRIMJER ISPRAVNOG VS. NEISPRAVNOG PISANJA
═══════════════════════════════════════════════════
❌ LOŠ PRIMJER (Tako nikada ne piši):
"Naš šampion plovi na karaveli uspjeha, baritone zlata, vašem je do zlata!"

✅ DOBAR PRIMJER (Tako piši):
"🏆 ČESTITAMO! Veliki uspjeh naših sportaša na Državnom prvenstvu u [MJESTO]! Naš [IME SPORTAŠA] osvojio je zlatnu medalju u kategoriji [KATEGORIJA]. Ponosni smo na vaš trud i predanost! 👏 #karateHrvatska #državnoprvak"

Komuniciraj i odgovaraj ISKLJUČIVO na standardnom hrvatskom jeziku.`;

function computeAge(datRod: string | null | undefined): number {
  if (!datRod || typeof datRod !== 'string') return 0;
  try {
    const today = new Date();
    const birth = new Date(datRod);
    if (isNaN(birth.getTime())) return 0;
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return Math.max(0, age);
  } catch {
    return 0;
  }
}

type SupabaseServerClient = ReturnType<typeof createServerClient>;

async function buildDynamicContext(supabase: SupabaseServerClient): Promise<string> {
  const today = new Date();

  const [klubResult, membersResult] = await Promise.all([
    supabase.from('klubovi').select('naziv, predsjednik').maybeSingle(),
    supabase.from('clanovi').select('ime, prezime, status, tip_clanstva, dat_rod, dat_uclan').order('prezime').order('ime'),
  ]);

  if (klubResult.error)    console.error('[AI context] klubovi error:', klubResult.error.message);
  if (membersResult.error) console.error('[AI context] clanovi error:', membersResult.error.message);

  console.log('[AI TAJNIK FETCH SUCCESS]', membersResult.data?.length ?? 'null');

  const klub = klubResult.data;

  // Normalise every row defensively — null fields must never crash a filter or map
  type ClanRow = {
    ime: string;
    prezime: string;
    status: string;
    tip_clanstva: string;
    dat_rod: string | null;
    dat_uclan: string | null;
  };

  const rawRows: unknown[] = Array.isArray(membersResult.data) ? membersResult.data : [];

  const members: ClanRow[] = rawRows.map((r): ClanRow => {
    const row = (r && typeof r === 'object' ? r : {}) as Record<string, unknown>;
    return {
      ime:          typeof row.ime          === 'string' ? row.ime          : '',
      prezime:      typeof row.prezime      === 'string' ? row.prezime      : '',
      status:       typeof row.status       === 'string' ? row.status       : 'aktivan',
      tip_clanstva: typeof row.tip_clanstva === 'string' ? row.tip_clanstva : 'redovni',
      dat_rod:      typeof row.dat_rod      === 'string' ? row.dat_rod      : null,
      dat_uclan:    typeof row.dat_uclan    === 'string' ? row.dat_uclan    : null,
    };
  });

  const totalCount     = members.length;
  const activeCount    = members.filter(m => m.status === 'aktivan').length;
  const neaktivniCount = members.filter(m => m.status === 'neaktivan').length;
  const suspendirani   = members.filter(m => m.status === 'suspendiran').length;

  const activeMembers  = members.filter(m => m.status === 'aktivan');
  const redovniCount   = activeMembers.filter(m => m.tip_clanstva === 'redovni').length;
  const podupirucCount = activeMembers.filter(m => m.tip_clanstva === 'podupiruci').length;
  const pocasniCount   = activeMembers.filter(m => m.tip_clanstva === 'pocasni').length;

  const adultActiveCount = activeMembers.filter(m => computeAge(m.dat_rod) >= 18).length;
  const votingCount = activeMembers.filter(
    m => m.tip_clanstva === 'redovni' && computeAge(m.dat_rod) >= 18,
  ).length;

  const quorumNeeded       = Math.floor(votingCount / 2) + 1;
  const terminationNeeded  = Math.ceil((votingCount * 2) / 3);

  console.log('[AI context] stats:', { totalCount, activeCount, votingCount });

  // Build named list — each row wrapped individually so one bad entry can't crash the whole list
  const votingMembers = activeMembers.filter(
    m => m.tip_clanstva === 'redovni' && computeAge(m.dat_rod) >= 18,
  );
  const votingMembersList = votingMembers.length > 0
    ? votingMembers.map((m, i) => {
        try {
          const age  = computeAge(m.dat_rod);
          const ime  = `${m.ime} ${m.prezime}`.trim() || '[ime nije uneseno]';
          const uclan = m.dat_uclan ? `, član od ${m.dat_uclan}` : '';
          return `  ${i + 1}. ${ime} (${age} god.${uclan})`;
        } catch {
          return `  ${i + 1}. [greška pri čitanju retka]`;
        }
      }).join('\n')
    : '  [nema članova koji ispunjavaju uvjete]';

  return `
═══════════════════════════════════════════════════
STVARNI PODACI KLUBA — BAZA PODATAKA (${today.toLocaleDateString('hr-HR')})
═══════════════════════════════════════════════════
VAŽNO: Ovo su STVARNI, ŽIVUĆI podaci iz baze podataka kluba. Koristiti ih izravno u odgovorima.
NIKADA ne reći korisniku da nemaš pristup podacima ili da ne znaš imena članova —
svi podaci uključujući puna imena su ti dostupni i prikazani ispod.
Kada korisnik traži popis glasača, formatiraj ga kao numerirani popis s imenom, prezimenom i godinama.

PODACI KLUBA:
  Naziv kluba:    ${klub?.naziv ?? '[naziv nije postavljen]'}
  Predsjednik:    ${klub?.predsjednik ?? '[predsjednik nije postavljen]'}

STATISTIKA ČLANSTVA (stvarno stanje):
  Ukupno registriranih članova: ${totalCount}
  Aktivnih:                     ${activeCount}
    ↳ Redovni članovi:          ${redovniCount}
    ↳ Podupirući članovi:       ${podupirucCount}
    ↳ Počasni članovi:          ${pocasniCount}
  Neaktivnih:                   ${neaktivniCount}
  Suspendiranih:                ${suspendirani}

GLASAČKA PRAVA (Statut, čl. 19. i 24.):
  Punoljetnih aktivnih članova (≥18 god.):             ${adultActiveCount}
  Članova s PRAVOM GLASA (aktivan + redovni + ≥18):    ${votingCount}
  Kvorum za redovnu skupštinu (više od polovice):      ${quorumNeeded} glasača
  Kvorum za prestanak rada kluba (2/3 glasača):        ${terminationNeeded} glasača

TOČAN POPIS ČLANOVA S PRAVOM GLASA (${votingCount} članova):
${votingMembersList}`;
}

export async function POST(req: NextRequest) {
  // Create the Supabase client by reading cookies directly from the NextRequest object.
  // This mirrors the middleware pattern so auth.uid() resolves correctly in Postgres
  // RLS policies — the middleware may have refreshed tokens onto req.cookies, which
  // cookies() from next/headers might not see (it reads the original request snapshot).
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return req.cookies.getAll(); },
        // Token refresh is handled by middleware before this handler runs.
        setAll() {},
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response(
      'ANTHROPIC_API_KEY nije konfiguriran. Dodajte ključ u Vercel environment variables.',
      { status: 503 }
    );
  }

  const { messages } = await req.json() as {
    messages: { role: 'user' | 'assistant'; content: string }[];
  };

  // Inject live club context into system prompt
  let dynamicContext = '';
  try {
    dynamicContext = await buildDynamicContext(supabase);
  } catch (err) {
    console.error('[AI context] buildDynamicContext threw:', err);
    // Continue with base prompt — AI will still function, just without live DB data
  }

  const fullSystemPrompt = dynamicContext
    ? `${SYSTEM_PROMPT}\n${dynamicContext}`
    : SYSTEM_PROMPT;

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const stream = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    temperature: 0.1,
    system: fullSystemPrompt,
    messages,
    stream: true,
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (
            event.type === 'content_block_delta' &&
            'delta' in event &&
            (event.delta as { type: string }).type === 'text_delta'
          ) {
            const text = (event.delta as { type: string; text: string }).text;
            controller.enqueue(encoder.encode(text));
          }
        }
      } catch (err) {
        controller.error(err);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
}
