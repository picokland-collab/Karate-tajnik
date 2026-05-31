import { createClient } from '@/lib/supabase-browser';

export interface KategorijaStats {
  kategorija: string;
  label: string;
  count: number;
}

export interface PojasStats {
  pojas: string;
  count: number;
}

export interface DobnaSkupina {
  skupina: string;
  count: number;
}

export interface MedaljeStats {
  zlato: number;
  srebro: number;
  bronca: number;
  ukupno: number;
}

export interface NatjecanjeRazinaStats {
  razina: string;
  label: string;
  count: number;
  medalje: number;
}

export interface FinancijskiPregled {
  aktivniClanovi: number;
  ukupnoClanovi: number;
  noviClanovi: number;
  neaktivniClanovi: number;
  suspendirani: number;
  procijenjeniGodisnji: number;
  procijenjeniMjesecni: number;
  godisnjaClanarina: number;
}

export interface GodisnjIzvjestajPodaci {
  klub: { naziv: string; predsjednik: string | null; grad: string | null } | null;
  godina: number;
  clanstvo: {
    aktivni: number;
    ukupno: number;
    novi: number;
    kategorije: KategorijaStats[];
  };
  natjecanja: {
    ukupno: number;
    natjecatelji: number;
    medalje: MedaljeStats;
    poRazini: NatjecanjeRazinaStats[];
  };
  sjednice: {
    ukupno: number;
    redovne: number;
    izvanredne: number;
  };
  dokumenti: { ukupno: number };
}

const KATEGORIJA_LABEL: Record<string, string> = {
  mali_karatist: 'Mali karatist',
  kadet:         'Kadet',
  junior:        'Junior',
  senior:        'Senior',
  veteran:       'Veteran',
};

const RAZINA_LABEL: Record<string, string> = {
  klubsko:      'Klubsko',
  zupanijsko:   'Županijsko',
  drzavno:      'Državno',
  medjunarodno: 'Međunarodno',
};

const KAT_ORDER = ['mali_karatist', 'kadet', 'junior', 'senior', 'veteran'];
const RAZINA_ORDER = ['medjunarodno', 'drzavno', 'zupanijsko', 'klubsko'];
const POJAS_ORDER = ['Bijeli pojas','Žuti pojas','Narančasti pojas','Zeleni pojas','Plavi pojas','Smeđi pojas','1. DAN','2. DAN','3. DAN'];

export async function fetchKategorijaStats(): Promise<KategorijaStats[]> {
  const supabase = createClient();
  const { data } = await supabase.from('clanovi').select('kategorija').eq('status', 'aktivan');

  const map = new Map<string, number>();
  for (const c of data ?? []) {
    const k = (c.kategorija as string) ?? 'senior';
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return KAT_ORDER.filter(k => map.has(k)).map(k => ({
    kategorija: k, label: KATEGORIJA_LABEL[k] ?? k, count: map.get(k)!,
  }));
}

export async function fetchPojasStats(): Promise<PojasStats[]> {
  const supabase = createClient();
  const { data } = await supabase.from('clanovi').select('pojas').eq('status', 'aktivan');

  const map = new Map<string, number>();
  for (const c of data ?? []) {
    const p = (c.pojas as string) ?? 'Bijeli pojas';
    map.set(p, (map.get(p) ?? 0) + 1);
  }
  return POJAS_ORDER.filter(p => map.has(p)).map(p => ({ pojas: p, count: map.get(p)! }));
}

export async function fetchDobnaDistribucija(): Promise<DobnaSkupina[]> {
  const supabase = createClient();
  const { data } = await supabase.from('clanovi').select('dat_rod').eq('status', 'aktivan');

  const thisYear = new Date().getFullYear();
  const bins = [
    { skupina: 'Do 9 god.',  min: 0,  max: 9,   count: 0 },
    { skupina: '10 – 14',    min: 10, max: 14,  count: 0 },
    { skupina: '15 – 18',    min: 15, max: 18,  count: 0 },
    { skupina: '19 – 30',    min: 19, max: 30,  count: 0 },
    { skupina: '31 – 50',    min: 31, max: 50,  count: 0 },
    { skupina: '51+',        min: 51, max: 120, count: 0 },
  ];
  for (const c of data ?? []) {
    if (!c.dat_rod) continue;
    const age = thisYear - new Date(c.dat_rod as string).getFullYear();
    const bin = bins.find(b => age >= b.min && age <= b.max);
    if (bin) bin.count++;
  }
  return bins.filter(b => b.count > 0).map(({ skupina, count }) => ({ skupina, count }));
}

export async function fetchMedaljeStats(): Promise<{
  medalje: MedaljeStats;
  poRazini: NatjecanjeRazinaStats[];
}> {
  const supabase = createClient();
  const { data } = await supabase
    .from('natjecanja')
    .select('razina, rezultati_natjecanja(medalja)');

  const med = { zlato: 0, srebro: 0, bronca: 0 };
  const razineMap = new Map<string, { count: number; medalje: number }>();

  for (const n of data ?? []) {
    const razina = n.razina as string;
    if (!razineMap.has(razina)) razineMap.set(razina, { count: 0, medalje: 0 });
    razineMap.get(razina)!.count++;

    for (const r of (n.rezultati_natjecanja as { medalja: string | null }[]) ?? []) {
      if (r.medalja === 'zlato')   { med.zlato++;   razineMap.get(razina)!.medalje++; }
      if (r.medalja === 'srebro')  { med.srebro++;  razineMap.get(razina)!.medalje++; }
      if (r.medalja === 'bronca')  { med.bronca++;  razineMap.get(razina)!.medalje++; }
    }
  }

  return {
    medalje: { ...med, ukupno: med.zlato + med.srebro + med.bronca },
    poRazini: RAZINA_ORDER.filter(r => razineMap.has(r)).map(r => ({
      razina: r,
      label: RAZINA_LABEL[r] ?? r,
      count: razineMap.get(r)!.count,
      medalje: razineMap.get(r)!.medalje,
    })),
  };
}

export async function fetchFinancijskiPregled(godisnjaClanarina = 600): Promise<FinancijskiPregled> {
  const supabase = createClient();
  const thisYear = new Date().getFullYear();

  const [aktivni, neaktivni, suspendirani, ukupno, noviData] = await Promise.all([
    supabase.from('clanovi').select('*', { count: 'exact', head: true }).eq('status', 'aktivan'),
    supabase.from('clanovi').select('*', { count: 'exact', head: true }).eq('status', 'neaktivan'),
    supabase.from('clanovi').select('*', { count: 'exact', head: true }).eq('status', 'suspendiran'),
    supabase.from('clanovi').select('*', { count: 'exact', head: true }),
    supabase.from('clanovi').select('id')
      .eq('status', 'aktivan')
      .gte('dat_uclan', `${thisYear}-01-01`)
      .lte('dat_uclan', `${thisYear}-12-31`),
  ]);

  const akt = aktivni.count ?? 0;
  return {
    aktivniClanovi:      akt,
    ukupnoClanovi:       ukupno.count ?? 0,
    noviClanovi:         noviData.data?.length ?? 0,
    neaktivniClanovi:    neaktivni.count ?? 0,
    suspendirani:        suspendirani.count ?? 0,
    godisnjaClanarina,
    procijenjeniGodisnji: akt * godisnjaClanarina,
    procijenjeniMjesecni: Math.round(akt * godisnjaClanarina / 12),
  };
}

export async function fetchGodisnjIzvjestajPodaci(godina?: number): Promise<GodisnjIzvjestajPodaci> {
  const supabase = createClient();
  const g = godina ?? new Date().getFullYear();
  const od  = `${g}-01-01`;
  const do_ = `${g}-12-31`;

  const [klub, ukupno, aktivni, novi, kategorije, natjecanja, sjednice, dokumenti] = await Promise.all([
    supabase.from('klubovi').select('naziv, predsjednik, grad').limit(1).maybeSingle(),
    supabase.from('clanovi').select('*', { count: 'exact', head: true }),
    supabase.from('clanovi').select('*', { count: 'exact', head: true }).eq('status', 'aktivan'),
    supabase.from('clanovi').select('*', { count: 'exact', head: true })
      .gte('dat_uclan', od).lte('dat_uclan', do_),
    supabase.from('clanovi').select('kategorija').eq('status', 'aktivan'),
    supabase.from('natjecanja')
      .select('razina, rezultati_natjecanja(clan_uuid, medalja)')
      .gte('datum', od).lte('datum', do_),
    supabase.from('sjednice').select('vrsta')
      .gte('zakazano_za', `${od}T00:00:00`)
      .lte('zakazano_za', `${do_}T23:59:59`),
    supabase.from('dokumenti').select('*', { count: 'exact', head: true })
      .gte('created_at', `${od}T00:00:00`)
      .lte('created_at', `${do_}T23:59:59`),
  ]);

  // Kategorije
  const katMap = new Map<string, number>();
  for (const c of kategorije.data ?? []) {
    const k = (c.kategorija as string) ?? 'senior';
    katMap.set(k, (katMap.get(k) ?? 0) + 1);
  }
  const kategorijeArr: KategorijaStats[] = KAT_ORDER.filter(k => katMap.has(k)).map(k => ({
    kategorija: k, label: KATEGORIJA_LABEL[k] ?? k, count: katMap.get(k)!,
  }));

  // Natjecanja
  const med = { zlato: 0, srebro: 0, bronca: 0 };
  const natjecateljiSet = new Set<string>();
  const razineMap = new Map<string, { count: number; medalje: number }>();

  for (const n of natjecanja.data ?? []) {
    const razina = n.razina as string;
    if (!razineMap.has(razina)) razineMap.set(razina, { count: 0, medalje: 0 });
    razineMap.get(razina)!.count++;

    for (const r of (n.rezultati_natjecanja as { clan_uuid: string | null; medalja: string | null }[]) ?? []) {
      if (r.clan_uuid) natjecateljiSet.add(r.clan_uuid);
      if (r.medalja === 'zlato')  { med.zlato++;  razineMap.get(razina)!.medalje++; }
      if (r.medalja === 'srebro') { med.srebro++; razineMap.get(razina)!.medalje++; }
      if (r.medalja === 'bronca') { med.bronca++; razineMap.get(razina)!.medalje++; }
    }
  }

  const sjedniceArr = sjednice.data ?? [];
  const klubData = klub.data as { naziv: string; predsjednik: string | null; grad?: string | null } | null;

  return {
    klub: klubData ? {
      naziv: klubData.naziv,
      predsjednik: klubData.predsjednik ?? null,
      grad: klubData.grad ?? null,
    } : null,
    godina: g,
    clanstvo: { aktivni: aktivni.count ?? 0, ukupno: ukupno.count ?? 0, novi: novi.count ?? 0, kategorije: kategorijeArr },
    natjecanja: {
      ukupno: natjecanja.data?.length ?? 0,
      natjecatelji: natjecateljiSet.size,
      medalje: { ...med, ukupno: med.zlato + med.srebro + med.bronca },
      poRazini: RAZINA_ORDER.filter(r => razineMap.has(r)).map(r => ({
        razina: r, label: RAZINA_LABEL[r] ?? r,
        count: razineMap.get(r)!.count, medalje: razineMap.get(r)!.medalje,
      })),
    },
    sjednice: {
      ukupno: sjedniceArr.length,
      redovne: sjedniceArr.filter(s => s.vrsta === 'redovna').length,
      izvanredne: sjedniceArr.filter(s => s.vrsta === 'izvanredna').length,
    },
    dokumenti: { ukupno: dokumenti.count ?? 0 },
  };
}

export function buildIzvjestajPrompt(podaci: GodisnjIzvjestajPodaci): string {
  const { klub, godina, clanstvo, natjecanja, sjednice, dokumenti } = podaci;
  const katTekst = clanstvo.kategorije.length
    ? clanstvo.kategorije.map(k => `${k.label}: ${k.count}`).join(', ')
    : 'nema podataka';
  const natjTekst = natjecanja.poRazini.length
    ? natjecanja.poRazini.map(r => `${r.label} (${r.count} natjecanja, ${r.medalje} medalja)`).join('; ')
    : 'nema evidentiranih natjecanja';

  return `Generiraj Godišnji izvještaj o radu za ${godina}. godinu.

PODACI O KLUBU:
Naziv: ${klub?.naziv ?? '[NAZIV KLUBA]'}
Predsjednik/ica: ${klub?.predsjednik ?? '[PREDSJEDNIK]'}
Grad: ${klub?.grad ?? '[GRAD]'}

STATISTIČKI PODACI ZA ${godina}. GODINU:

ČLANSTVO:
- Ukupno registriranih članova: ${clanstvo.ukupno}
- Aktivnih članova: ${clanstvo.aktivni}
- Novih članova u ${godina}. godini: ${clanstvo.novi}
- Raspodjela po kategorijama (aktivni): ${katTekst}

NATJECANJA I SPORTSKI REZULTATI:
- Ukupno natjecanja u ${godina}. godini: ${natjecanja.ukupno}
- Broj nastupljenih natjecatelja: ${natjecanja.natjecatelji}
- Medalje: ${natjecanja.medalje.zlato} zlatnih, ${natjecanja.medalje.srebro} srebrnih, ${natjecanja.medalje.bronca} brončanih (ukupno ${natjecanja.medalje.ukupno} medalja)
- Raspodjela po razini natjecanja: ${natjTekst}

SKUPŠTINE I TIJELA KLUBA:
- Ukupno sjednica: ${sjednice.ukupno}
- Redovnih skupština: ${sjednice.redovne}
- Izvanrednih sjednica: ${sjednice.izvanredne}

DOKUMENTACIJA:
- Dokumenata kreiranih u ${godina}. godini: ${dokumenti.ukupno}

Napiši formalni Godišnji izvještaj o radu koji se podnosi Zajednici sportskih udruga. Strukturiraj ga s ovim odjeljcima (koristi ## za naslove):

## 1. Uvod i opći podaci o klubu
## 2. Pregled rada i aktivnosti u ${godina}. godini
## 3. Stanje i kretanje članstva
## 4. Sportski rezultati i natjecanja
## 5. Rad tijela kluba (skupštine i upravni odbor)
## 6. Zaključak i planovi za ${godina + 1}. godinu

Završi s potpisom predsjednika kluba i mjestom za pečat. Koristi formalni pravno-administrativni stil.`;
}
