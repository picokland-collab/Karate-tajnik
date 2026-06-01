// @ts-check
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

/**
 * Coordinates verified against zahtjev_prazan.pdf (595.28 × 841.89 pt, A4).
 * Origin: bottom-left. Units: points.
 *
 * Content-stream text anchors:
 *   "Ime i prezime člana"    y=548.0  x=45.4   → fill at x=215
 *   "Datum rođenja"           y=519.7  x=45.4   → fill at x=215
 *   "OIB"                     y=491.4  x=45.4   → fill at x=215
 *   "Mjesto i država rođenja" y=463.0  x=45.4   → place x=215; country x=420
 *   "Ime i prezime člana"     y=265.2  x=116.0  → printed name above at y=278
 *   "U" (member block)        y=227.7  x=45.4   | "," x=246.5 | "20" x=305.5
 *   "U" (club block)          y=94.5   x=158.7  | "," x=359.8 | "20" x=418.9
 *   "M.P."                    y=146.1  x=289.1  → stamp centred here
 *   "potpis ovlaštene osobe"  y=160.3  x=413.8  → signature above
 *   "Datum i vrijeme ispisa"  y=52.9   x=45.4   → replace with live timestamp
 */
const COORDS = {
  // ── member data fields ───────────────────────────────────────────
  imePrezime:     { x: 215, y: 548.0 },
  datumRodjenja:  { x: 215, y: 519.7 },
  oib:            { x: 215, y: 491.4 },
  mjestRodjenja:  { x: 215, y: 463.0 },
  drzavaRodjenja: { x: 420, y: 463.0 },

  // ── member printed name below signature line ─────────────────────
  imePrezimePrint: { x: 100, y: 278.0 },

  // ── member block: "U [city], [DD.MM.] 20[YY]" (y=227.7) ─────────
  clanGrad:    { x: 57,  y: 227.7 },
  clanDatumDM: { x: 252, y: 227.7 },
  clanDatumYY: { x: 319, y: 227.7 },

  // ── club block: "U [city], [DD.MM.] 20[YY]" (y=94.5) ───────────
  klubGrad:    { x: 170, y: 94.5 },
  klubDatumDM: { x: 364, y: 94.5 },
  klubDatumYY: { x: 433, y: 94.5 },

  // ── stamp: centred on M.P. (289.1, 146.1) ───────────────────────
  zig:    { x: 234, y: 91,  width: 110, height: 110 },

  // ── signature: above "potpis ovlaštene osobe" (413.8, 160.3) ────
  potpis: { x: 405, y: 172, width: 100, height: 40  },

  // ── "Datum i vrijeme ispisa" replacement ────────────────────────
  datumIspisa: { x: 45.4, y: 52.9 },
};

const FONT_SIZE  = 9;
const TEXT_COLOR = rgb(0, 0, 0);
const WHITE      = rgb(1, 1, 1);

/** "YYYY-MM-DD" → "DD.MM.YYYY" (no trailing period — HKS birth date format) */
function formatBirthDate(/** @type {string} */ iso) {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

/** Returns parts needed for U__ lines from current date. */
function todayParts() {
  const d  = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(2);   // "26", no period
  return { dm: `${dd}.${mm}.`, yy };
}

/** "DD.MM.YYYY HH:MM:SS" — live timestamp for "Datum i vrijeme ispisa" */
function formatDateTime() {
  const d    = new Date();
  const dd   = String(d.getDate()).padStart(2, '0');
  const mm   = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const HH   = String(d.getHours()).padStart(2, '0');
  const MM   = String(d.getMinutes()).padStart(2, '0');
  const SS   = String(d.getSeconds()).padStart(2, '0');
  return `${dd}.${mm}.${yyyy} ${HH}:${MM}:${SS}`;
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
 *   obrasci/zahtjev_prazan.pdf    — blank HKS form (A4, static layout)
 *   pecati/zig_prozirni.png.png   — transparent club stamp (PNG with alpha)
 *   pecati/ivan_potpis.png.png    — Ivan's signature (PNG with alpha)
 *   fonts/NotoSans-Regular.ttf    — optional; enables Croatian diacritics
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
    fetchStorageFile(supabase, BUCKET, 'pecati/zig_prozirni.png.png'),
    fetchStorageFile(supabase, BUCKET, 'pecati/ivan_potpis.png.png'),
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

  // ── member data ──────────────────────────────────────────────────
  const fullName = `${member.firstName.toUpperCase()} ${member.lastName.toUpperCase()}`;
  draw('imePrezime',      fullName);
  draw('datumRodjenja',   member.birthDate ? formatBirthDate(member.birthDate) : '');
  draw('oib',             member.oib ?? '');
  draw('mjestRodjenja',   (member.mjestRodjenja ?? '').toUpperCase());
  draw('drzavaRodjenja',  member.drzavaRodjenja ?? '');

  // ── member printed name (below signature line) ───────────────────
  draw('imePrezimePrint', fullName);

  // ── member U__ block ─────────────────────────────────────────────
  const { dm, yy } = todayParts();
  draw('clanGrad',    'Đurđevcu');
  draw('clanDatumDM', dm);
  draw('clanDatumYY', yy);

  // ── club U__ block ───────────────────────────────────────────────
  draw('klubGrad',    'Đurđevcu');
  draw('klubDatumDM', dm);
  draw('klubDatumYY', yy);

  // ── replace baked-in "Datum i vrijeme ispisa" with live timestamp ─
  page.drawRectangle({
    x: 43, y: 47, width: 320, height: 13,
    color: WHITE,
  });
  draw('datumIspisa', `Datum i vrijeme ispisa: ${formatDateTime()}`);

  // ── prozirni žig (centred on M.P. at 289, 146) ───────────────────
  page.drawImage(zigImage, {
    x:       COORDS.zig.x,
    y:       COORDS.zig.y,
    width:   COORDS.zig.width,
    height:  COORDS.zig.height,
    opacity: 0.85,
  });

  // ── Ivan's signature (above "potpis ovlaštene osobe") ────────────
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
