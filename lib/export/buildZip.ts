import JSZip from 'jszip';
import { createHash } from 'crypto';
import type { Member } from '@/lib/types';
import type { Sjednica } from '@/lib/queries/sjednice';
import type { Trener } from '@/lib/queries/treneri';
import { ULOGA_LABEL, LICENCA_LABEL } from '@/lib/queries/treneri';
import {
  renderClanoviPdf,
  renderGdprPdf,
  renderLijecnickiPdf,
  renderSkupstinePdf,
  renderTreneriPdf,
} from './templates';

export interface ExportData {
  klubNaziv: string;
  clanovi: Member[];
  sjednice: Sjednica[];
  treneri: Trener[];
}

// ── HELPERS ───────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[šŠ]/g, 's').replace(/[đĐ]/g, 'd')
    .replace(/[žŽ]/g, 'z').replace(/[čČćĆ]/g, 'c')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function sha256hex(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex');
}

function toBuffer(content: string): Buffer {
  return Buffer.from(content, 'utf-8');
}

// ── CSV BUILDER ───────────────────────────────────────────────

const BELT_HR: Record<string, string> = {
  bijeli: 'Bijeli', žuti: 'Žuti', narančasti: 'Narančasti',
  zeleni: 'Zeleni', plavi: 'Plavi', smeđi: 'Smeđi',
  'crni-1': '1. DAN', 'crni-2': '2. DAN', 'crni-3': '3. DAN',
};
const TIP_HR: Record<string, string> = {
  redovni: 'Redovni', podupiruci: 'Podupirući', pocasni: 'Počasni',
};
const CAT_HR: Record<string, string> = {
  mali_karatist: 'Mali karatist', kadet: 'Kadet',
  junior: 'Junior', senior: 'Senior', veteran: 'Veteran',
};

function q(v: string | null | undefined): string {
  if (!v) return '';
  return `"${String(v).replace(/"/g, '""')}"`;
}

function buildClanoviCsv(clanovi: Member[]): Buffer {
  const cols = [
    'Rb', 'Ime', 'Prezime', 'Datum rođenja', 'E-mail', 'Telefon', 'Adresa',
    'Kategorija', 'Pojas', 'Tip članstva', 'Datum učlanjenja',
    'Status', 'Istek liječničkog', 'GDPR privola', 'Skrbnik',
  ];
  const rows = clanovi.map((m, i) => [
    i + 1,
    q(m.firstName), q(m.lastName),
    m.birthDate || '',
    m.email || '', m.phone || '',
    q(m.adresa),
    CAT_HR[m.category] ?? m.category,
    BELT_HR[m.belt] ?? m.belt,
    TIP_HR[m.tipClanstva ?? 'redovni'],
    m.memberSince || '',
    m.status,
    m.medicalExpiry || '',
    m.consentSigned ? 'Da' : 'Ne',
    q(m.guardian),
  ].join(','));

  // BOM prefix → Excel opens UTF-8 CSV correctly
  return Buffer.from('﻿' + [cols.join(','), ...rows].join('\r\n'), 'utf-8');
}

function buildGdprNedostajeTxt(clanovi: Member[]): Buffer {
  const bez = clanovi.filter(c => !c.consentSigned);
  const lines = [
    `GDPR privola nedostaje — ${bez.length} clanova`,
    '='.repeat(50),
    '',
    ...bez.map((m, i) => `${i + 1}. ${m.firstName} ${m.lastName} (${CAT_HR[m.category] ?? m.category}, ${m.status})`),
    '',
    `Generirano: ${new Date().toLocaleDateString('hr-HR')}`,
  ];
  return toBuffer(lines.join('\n'));
}

function buildSjednicaTxt(sj: Sjednica, klubNaziv: string): Buffer {
  const vrstaLabel =
    sj.vrsta === 'izvanredna' ? 'IZVANREDNA' :
    sj.vrsta === 'osnivacka'  ? 'OSNIVACKA'  : 'REDOVNA';

  const lines = [
    `${vrstaLabel} SKUPSTINA`,
    klubNaziv,
    '='.repeat(50),
    '',
    `Datum:  ${sj.datum}`,
    `Vrijeme: ${sj.vrijeme}h`,
    `Mjesto: ${sj.lokacija}`,
    `Status: ${sj.status}`,
    '',
    'DNEVNI RED:',
    ...sj.dnevni_red.map((t, i) => `  ${i + 1}. ${t}`),
    ...(sj.napomena ? ['', `Napomena: ${sj.napomena}`] : []),
    '',
    `Generirano: ${new Date().toLocaleDateString('hr-HR')} | Digitalni tajnik`,
  ];
  return toBuffer(lines.join('\n'));
}

// ── MANIFEST BUILDER ──────────────────────────────────────────

function buildTreneriCsv(treneri: Trener[]): Buffer {
  const cols = [
    'Rb', 'Ime', 'Prezime', 'Uloga', 'Vrsta licence',
    'Broj licence', 'Vrijedi do', 'E-mail', 'Mobitel', 'Status',
  ];
  const rows = treneri.map((t, i) => [
    i + 1,
    q(t.ime), q(t.prezime),
    t.uloga   ? (ULOGA_LABEL[t.uloga]   ?? t.uloga)   : '',
    t.licenca ? (LICENCA_LABEL[t.licenca] ?? t.licenca) : '',
    q(t.brLic),
    t.licVrijedi || '',
    t.email || '',
    t.mob   || '',
    t.status,
  ].join(','));
  return Buffer.from('﻿' + [cols.join(','), ...rows].join('\r\n'), 'utf-8');
}

function buildManifest(
  hashes: { path: string; sha256: string }[],
  klubNaziv: string,
  clanovi: Member[],
  sjednice: Sjednica[],
  treneri: Trener[],
): Buffer {
  const now = new Date().toLocaleString('hr-HR', {
    timeZone: 'Europe/Zagreb',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });

  const line = '─'.repeat(56);
  const lines = [
    '╔════════════════════════════════════════════════════════╗',
    '║   DIGITALNI TAJNIK — INSPEKCIJSKA ARHIVA               ║',
    '╚════════════════════════════════════════════════════════╝',
    '',
    `Klub:        ${klubNaziv}`,
    `Generirano:  ${now} (Europe/Zagreb)`,
    '',
    line,
    'SADRZAJ ARHIVE — SHA-256 OTISCI INTEGRITETA',
    line,
    '',
    ...hashes.map(h => `${h.sha256}  ${h.path}`),
    '',
    line,
    `Ukupno datoteka:  ${hashes.length}`,
    `Ukupno clanova:   ${clanovi.length} (${clanovi.filter(c => c.status === 'aktivan').length} aktivnih)`,
    `S GDPR privolom:  ${clanovi.filter(c => c.consentSigned).length}/${clanovi.length}`,
    `Skupstine:        ${sjednice.length}`,
    `Treneri:          ${treneri.length} (${treneri.filter(t => t.status === 'aktivan').length} aktivnih)`,
    '',
    line,
    'NAPOMENA O INTEGRITETU',
    line,
    '',
    'SHA-256 sazetci iznad su kriptografski otisci svakog dokumenta.',
    'Ovaj manifest moze se koristiti kao dokaz integriteta arhive',
    'pred inspekcijskim tijelima (Ministarstvo sporta, HKS, porezna).',
    '',
    'Za provjeru: sha256sum <datoteka> mora odgovarati vrijednosti iznad.',
    '',
    'Generirano programom Digitalni tajnik',
    'https://digitalni-tajnik.vercel.app',
  ];

  return toBuffer(lines.join('\n'));
}

// ── MAIN EXPORT ───────────────────────────────────────────────

export async function buildInspekcijskiZip(
  data: ExportData,
): Promise<{ zip: Uint8Array; filename: string }> {
  const { klubNaziv, clanovi, sjednice, treneri } = data;

  const datum    = new Date().toISOString().slice(0, 10);
  const filename = `digitalni-tajnik-${slugify(klubNaziv)}-${datum}.zip`;

  const zip    = new JSZip();
  const hashes: { path: string; sha256: string }[] = [];

  function addFile(path: string, buf: Buffer): void {
    zip.file(path, buf);
    hashes.push({ path, sha256: sha256hex(buf) });
  }

  // ── Generate PDFs in parallel ──────────────────────────────
  const [clanoviPdf, gdprPdf, lijecnickiPdf, skupstinePdf, treneriPdf] = await Promise.all([
    renderClanoviPdf(clanovi, klubNaziv),
    renderGdprPdf(clanovi, klubNaziv),
    renderLijecnickiPdf(clanovi, klubNaziv),
    renderSkupstinePdf(sjednice, klubNaziv),
    renderTreneriPdf(treneri, klubNaziv),
  ]);

  // ── 01-clanovi ────────────────────────────────────────────
  addFile('01-clanovi/popis-clanova.pdf', clanoviPdf);
  addFile('01-clanovi/popis-clanova.csv', buildClanoviCsv(clanovi));

  // ── 02-privole ────────────────────────────────────────────
  addFile('02-privole/gdpr-status.pdf', gdprPdf);
  const bezPrivole = clanovi.filter(c => !c.consentSigned);
  if (bezPrivole.length > 0) {
    addFile('02-privole/privola-nedostaje.txt', buildGdprNedostajeTxt(clanovi));
  }

  // ── 03-skupstine ──────────────────────────────────────────
  addFile('03-skupstine/skupstine-pregled.pdf', skupstinePdf);
  for (const sj of sjednice) {
    const vrstaSlug =
      sj.vrsta === 'izvanredna' ? 'izvanredna' :
      sj.vrsta === 'osnivacka'  ? 'osnivacka'  : 'redovna';
    addFile(
      `03-skupstine/${sj.datum}-${vrstaSlug}.txt`,
      buildSjednicaTxt(sj, klubNaziv),
    );
  }

  // ── 04-lijecnicki ─────────────────────────────────────────
  addFile('04-lijecnicki/pregledi-status.pdf', lijecnickiPdf);

  // ── 05-treneri ────────────────────────────────────────────
  addFile('05-treneri/popis-trenera.pdf', treneriPdf);
  addFile('05-treneri/popis-trenera.csv', buildTreneriCsv(treneri));

  // ── MANIFEST (last — after all hashes computed) ───────────
  const manifestBuf = buildManifest(hashes, klubNaziv, clanovi, sjednice, treneri);
  zip.file('MANIFEST.txt', manifestBuf); // NOT in hashes by convention

  // ── Compress ──────────────────────────────────────────────
  const zipBuffer = await zip.generateAsync({
    type: 'uint8array',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  return { zip: zipBuffer, filename };
}
