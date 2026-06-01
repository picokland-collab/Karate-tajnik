// @ts-check
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

/**
 * Coordinates verified against zahtjev_prazan.pdf (595.28 × 841.89 pt, A4).
 * Origin: bottom-left. Units: points.
 *
 * Content-stream text anchors used for calibration:
 *   "Ime i prezime člana"   y=548.0  x=45.4   → fill at x=215
 *   "Datum rođenja"          y=519.7  x=45.4   → fill at x=215; ". ." end-marks at x=414
 *   "OIB"                    y=491.4  x=45.4   → fill at x=215
 *   "Mjesto i država rođenja" y=463.0 x=45.4   → fill at x=215; ", " separator at x=414.5
 *   "U"(club footer)         y=94.5   x=158.7
 *   ","(club footer)         y=94.5   x=359.8
 *   "20"(club footer)        y=94.5   x=418.9  → pre-printed "20"; write last 2 year digits after
 *   "M.P."                   y=146.1  x=289.1  → stamp centred on this point
 *   "potpis ovlaštene osobe" y=160.3  x=413.8  → signature image above this label
 */
const COORDS = {
  // ── member data ──────────────────────────────────────────────────
  imePrezime:     { x: 215, y: 548.0 },
  datumRodjenja:  { x: 215, y: 519.7 },
  oib:            { x: 215, y: 491.4 },
  mjestRodjenja:  { x: 215, y: 463.0 },   // before ", " at x=414.5
  drzavaRodjenja: { x: 420, y: 463.0 },   // after  ", " at x=414.5

  // ── club footer: "U [city], [DD.MM.][20YY.]" ─────────────────────
  // "U" anchor x=158.7 — city starts immediately after
  klubGrad: { x: 170, y: 94.5 },
  // "," anchor x=359.8 — day+month starts just after
  klubDatumDM: { x: 364, y: 94.5 },
  // "20" anchor x=418.9 (~14 pt wide at 9pt) — last 2 year digits follow
  klubDatumYY: { x: 433, y: 94.5 },

  // ── stamp: centred on M.P. (289.1, 146.1) ────────────────────────
  zig: { x: 234, y: 91, width: 110, height: 110 },

  // ── signature: above "potpis ovlaštene osobe" label (413.8, 160.3) ─
  potpis: { x: 405, y: 172, width: 100, height: 40 },
};

const FONT_SIZE  = 9;
const TEXT_COLOR = rgb(0, 0, 0);

/** "YYYY-MM-DD" or Date → "DD.MM.YYYY." */
function formatDate(/** @type {string | Date} */ dateInput) {
  const d  = dateInput instanceof Date ? dateInput : new Date(dateInput);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return { full: `${dd}.${mm}.${d.getFullYear()}.`, dm: `${dd}.${mm}.`, yy: String(d.getFullYear()).slice(2) + '.' };
}

/** @param {import('@supabase/supabase-js').SupabaseClient} supabase @param {string} bucket @param {string} path */
async function fetchStorageFile(supabase, bucket, path) {
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error) throw new Error(`Supabase storage (${bucket}/${path}): ${error.message}`);
  return data.arrayBuffer();
}

/**
 * Generates a filled HKS "zahtjev za prvu registraciju" PDF.
 *
 * Required assets in Supabase bucket "klub-assets":
 *   obrasci/zahtjev_prazan.pdf   — blank HKS form (A4, static layout)
 *   pecati/zig_prozirni.png      — transparent club stamp (PNG with alpha)
 *   pecati/ivan_potpis.png       — Ivan's signature (PNG with alpha)
 *   fonts/NotoSans-Regular.ttf   — optional; enables Croatian diacritics
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ firstName: string, lastName: string, birthDate: string,
 *           mjestRodjenja?: string, drzavaRodjenja?: string, oib?: string,
 *           guardian?: string }} member
 * @returns {Promise<Uint8Array>}
 */
export async function generateHksZahtjev(supabase, member) {
  const BUCKET = 'klub-assets';

  const [formBytes, zigBytes, potpisBytes] = await Promise.all([
    fetchStorageFile(supabase, BUCKET, 'obrasci/zahtjev_prazan.pdf'),
    fetchStorageFile(supabase, BUCKET, 'pecati/zig_prozirni.png'),
    fetchStorageFile(supabase, BUCKET, 'pecati/ivan_potpis.png'),
  ]);

  const pdfDoc = await PDFDocument.load(formBytes);
  pdfDoc.registerFontkit(fontkit);

  // Prefer embedded Unicode font for Croatian diacritics; fall back to Helvetica.
  let font;
  try {
    const fontBytes = await fetchStorageFile(supabase, BUCKET, 'fonts/NotoSans-Regular.ttf');
    font = await pdfDoc.embedFont(fontBytes);
  } catch {
    font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  }

  const zigImage    = await pdfDoc.embedPng(zigBytes);
  const potpisImage = await pdfDoc.embedPng(potpisBytes);
  const page        = pdfDoc.getPages()[0];

  const draw = (/** @type {any} */ key, /** @type {any} */ text) => {
    if (!text) return;
    const { x, y } = (/** @type {any} */ (COORDS))[key];
    page.drawText(String(text), { x, y, size: FONT_SIZE, font, color: TEXT_COLOR });
  };

  // ── member data ────────────────────────────────────────────────────
  draw('imePrezime',     `${member.lastName} ${member.firstName}`);
  draw('datumRodjenja',  member.birthDate ? formatDate(member.birthDate).full : '');
  draw('oib',            member.oib ?? '');
  draw('mjestRodjenja',  member.mjestRodjenja ?? '');
  draw('drzavaRodjenja', member.drzavaRodjenja ?? '');

  // ── club footer ────────────────────────────────────────────────────
  const today = formatDate(new Date());
  draw('klubGrad',     'Đurđevac');
  draw('klubDatumDM',  today.dm);   // "01.06." — fits between "," and pre-printed "20"
  draw('klubDatumYY',  today.yy);   // "26."    — follows pre-printed "20"

  // ── prozirni žig (centred on M.P. at 289, 146) ───────────────────
  page.drawImage(zigImage, {
    x:       COORDS.zig.x,
    y:       COORDS.zig.y,
    width:   COORDS.zig.width,
    height:  COORDS.zig.height,
    opacity: 0.85,
  });

  // ── Ivan's signature (above "potpis ovlaštene osobe" label) ───────
  page.drawImage(potpisImage, {
    x:      COORDS.potpis.x,
    y:      COORDS.potpis.y,
    width:  COORDS.potpis.width,
    height: COORDS.potpis.height,
  });

  return pdfDoc.save();
}

/**
 * Browser helper — triggers a Save-As download of the generated PDF.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {Parameters<typeof generateHksZahtjev>[1]} member
 * @param {string} [filename]
 */
export async function downloadHksZahtjev(supabase, member, filename) {
  const bytes = await generateHksZahtjev(supabase, member);
  const blob  = new Blob([/** @type {ArrayBuffer} */ (bytes.buffer)], { type: 'application/pdf' });
  const url   = URL.createObjectURL(blob);
  const a     = document.createElement('a');
  a.href      = url;
  a.download  = filename ?? `HKS_zahtjev_${member.lastName}_${member.firstName}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
