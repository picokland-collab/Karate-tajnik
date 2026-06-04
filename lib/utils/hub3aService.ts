import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

// ── TYPES ────────────────────────────────────────────────────────

export interface Hub3aParams {
  // Payer (member)
  payerName:      string;   // max 30
  payerStreet?:   string;   // max 27
  payerCity?:     string;   // max 27
  // Recipient (club)
  recipientName:  string;   // max 25
  recipientStreet?: string; // max 25
  recipientCity?:   string; // max 25
  recipientIban:  string;   // no spaces
  // Payment
  amountEur:      number;   // e.g. 20.00
  description:    string;   // STRICTLY max 35 chars in barcode
  memberId:       number;   // used in Poziv na broj (HR67)
  purposeCode?:   string;   // default 'NTRN'
}

// ── FORMATTERS ────────────────────────────────────────────────────

/** EUR → eurocents, 15-char left-padded string.  20.00 → "000000000002000" */
function fmtAmount(eur: number): string {
  return String(Math.round(eur * 100)).padStart(15, '0');
}

/** HR67 + 6-digit member ID */
function pozivNaBroj(memberId: number): string {
  return `HR67${String(memberId).padStart(6, '0')}`;
}

/**
 * Unicode-safe truncation by CHARACTER count (not byte count).
 * Spread into code-point array so Č Ć Ž Š Đ count as 1 character,
 * matching the HUB 3A field-length spec.
 */
const trunc = (s: string, n: number): string => [...(s ?? '')].slice(0, n).join('');

// ── HUB 3A BARCODE TEXT ───────────────────────────────────────────

/**
 * Builds the HUB 3A barcode payload (Croatian Banking Association standard).
 * Fields are newline-separated; description is STRICTLY capped at 35 chars.
 */
export function buildHub3aText(p: Hub3aParams): string {
  return [
    'HRVHUB30',
    'EUR',
    fmtAmount(p.amountEur),
    trunc(p.payerName,         30),
    trunc(p.payerStreet  ?? '', 27),
    trunc(p.payerCity    ?? '', 27),
    trunc(p.recipientName,     25),
    trunc(p.recipientStreet ?? '', 25),
    trunc(p.recipientCity   ?? '', 25),
    p.recipientIban.replace(/\s/g, ''),
    pozivNaBroj(p.memberId),
    trunc(p.purposeCode ?? 'NTRN', 4),
    trunc(p.description, 35),
  ].join('\n');
}

// ── PDF LAYOUT ───────────────────────────────────────────────────

const BLACK = rgb(0, 0, 0);
const GREY  = rgb(0.5, 0.5, 0.5);

/**
 * Assembles a HUB 3A payment slip PDF (210×105 mm) from pre-rendered barcode PNG bytes.
 * Works in both Node.js (API route) and browser (client fallback).
 */
export async function assemblePdf(p: Hub3aParams, pngBytes: Uint8Array): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font   = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontB  = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // 210 × 105 mm in points (1mm ≈ 2.8346pt)
  const W = 595.28;
  const H = 297.64;
  const page = pdfDoc.addPage([W, H]);

  const mid = W / 2;

  // Section borders
  page.drawRectangle({ x: 8,       y: 88, width: mid - 16, height: H - 96, borderColor: GREY, borderWidth: 0.5 });
  page.drawRectangle({ x: mid + 8, y: 88, width: mid - 16, height: H - 96, borderColor: GREY, borderWidth: 0.5 });
  // Barcode area
  page.drawRectangle({ x: 8, y: 8, width: W - 16, height: 76, borderColor: GREY, borderWidth: 0.5, color: rgb(0.96, 0.96, 0.96) });

  const label = (t: string, x: number, y: number) =>
    page.drawText(t, { x, y, size: 6.5, font, color: GREY });
  const field = (t: string, x: number, y: number, size = 8.5, bold = false) =>
    page.drawText(t.slice(0, 70), { x, y, size, font: bold ? fontB : font, color: BLACK });

  const poziv = pozivNaBroj(p.memberId);

  // ── LEFT: payer ──────────────────────────────────────────────
  let ly = H - 22;
  page.drawText('UPLATA', { x: 14, y: ly, size: 7.5, font: fontB, color: GREY });
  ly -= 14;

  label('Platitelj / Payer', 14, ly);            ly -= 10;
  field(p.payerName.slice(0, 30), 14, ly, 9, true); ly -= 11;
  if (p.payerStreet) { field(p.payerStreet.slice(0, 27), 14, ly); ly -= 10; }
  if (p.payerCity)   { field(p.payerCity.slice(0, 27),   14, ly); ly -= 10; }
  ly -= 4;

  label('Iznos / Amount', 14, ly);               ly -= 10;
  field(`EUR  ${p.amountEur.toFixed(2)}`, 14, ly, 11, true); ly -= 14;

  label('Opis plaćanja / Payment description', 14, ly); ly -= 10;
  field(trunc(p.description, 35), 14, ly, 8);   ly -= 12;

  label('Model i poziv na broj', 14, ly);        ly -= 10;
  field(poziv, 14, ly, 9, true);

  // ── RIGHT: recipient ─────────────────────────────────────────
  let ry = H - 22;
  page.drawText('PRIMLJENO', { x: mid + 14, y: ry, size: 7.5, font: fontB, color: GREY });
  ry -= 14;

  label('Primatelj / Recipient', mid + 14, ry);  ry -= 10;
  field(p.recipientName.slice(0, 25), mid + 14, ry, 9, true); ry -= 11;
  if (p.recipientStreet) { field(p.recipientStreet.slice(0, 25), mid + 14, ry); ry -= 10; }
  if (p.recipientCity)   { field(p.recipientCity.slice(0, 25),   mid + 14, ry); ry -= 10; }
  ry -= 4;

  label('IBAN primatelja', mid + 14, ry);        ry -= 10;
  const ibanFmt = p.recipientIban.replace(/\s/g, '').replace(/(.{4})/g, '$1 ').trim();
  field(ibanFmt, mid + 14, ry, 8, true);         ry -= 13;

  label('Iznos / Amount', mid + 14, ry);         ry -= 10;
  field(`EUR  ${p.amountEur.toFixed(2)}`, mid + 14, ry, 11, true); ry -= 14;

  label('Model i poziv na broj', mid + 14, ry);  ry -= 10;
  field(poziv, mid + 14, ry, 9, true);           ry -= 13;

  label('Šifra namjene / Purpose code', mid + 14, ry); ry -= 10;
  field(p.purposeCode ?? 'NTRN', mid + 14, ry, 8);

  // ── BARCODE ──────────────────────────────────────────────────
  const barcodeImg = await pdfDoc.embedPng(pngBytes);
  const bW = 164;  // ≤58mm
  const bH = 62;   // ≤26mm
  page.drawImage(barcodeImg, { x: (W - bW) / 2, y: 14, width: bW, height: bH });

  page.drawText('2D kod (HUB 3A / PDF417)', {
    x: (W / 2) - 52, y: 9, size: 6.5, font, color: GREY,
  });

  return pdfDoc.save();
}

// ── CLIENT DOWNLOAD HELPER ────────────────────────────────────────

/**
 * Calls the server-side barcode API route and triggers a Save-As download.
 * The API handles PDF417 rendering and caching.
 */
export async function downloadHub3aSlip(p: Hub3aParams, filename?: string): Promise<void> {
  const res = await fetch('/api/hub3a/barcode', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(p),
  });
  if (!res.ok) {
    const msg = await res.text();
    throw new Error(msg || 'Greška pri generiranju uplatnice');
  }
  const blob = await res.blob();
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename ?? `uplatnica_${p.memberId}_${new Date().getFullYear()}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
