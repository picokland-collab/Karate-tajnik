// @ts-check
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

/**
 * Coordinates for zahtjev_prazan.pdf (595.28 × 841.89 pt, A4).
 * Origin: bottom-left. Units: points.
 */
const COORDS = {
  // ── member data fields (11pt bold, centered on x=215..545 line) ───
  // x stores the center point (380); drawBold() subtracts half text width.
  imePrezime:     { x: 380, y: 546.0 },
  datumRodjenja:  { x: 380, y: 518.0 },
  oib:            { x: 380, y: 490.0 },
  mjestRodjenja:  { x: 380, y: 462.0 },

  // ── printed name below member signature line ──────────────────────
  imePrezimePrint: { x: 116, y: 278.0 },

  // ── member block: "U [city], [DD.MM.] 20[YY]" ────────────────────
  clanGrad:    { x: 57,  y: 227.7 },
  clanDatumDM: { x: 252, y: 227.7 },
  clanDatumYY: { x: 319, y: 227.7 },

  // ── club block: "U [city], [DD.MM.] 20[YY]" ──────────────────────
  klubGrad:    { x: 170, y: 94.5 },
  klubDatumDM: { x: 364, y: 94.5 },
  klubDatumYY: { x: 433, y: 94.5 },

  // ── stamp ─────────────────────────────────────────────────────────
  zig:    { x: 234, y: 91,  width: 110, height: 110 },

  // ── signature ─────────────────────────────────────────────────────
  potpis: { x: 405, y: 172, width: 100, height: 40 },

  // ── timestamp ─────────────────────────────────────────────────────
  datumIspisa: { x: 45.4, y: 52.9 },
};

const MEMBER_FONT_SIZE = 11;
const BODY_FONT_SIZE   = 9;
const TEXT_COLOR       = rgb(0, 0, 0);
const WHITE            = rgb(1, 1, 1);

/** Collapse consecutive dots, then strip leading/trailing whitespace, dots, and commas. */
function sanitize(/** @type {string} */ s) {
  return s
    .replace(/\.{2,}/g, '.')           // ".." or "..." → "."
    .replace(/^[\s.,]+|[\s.,]+$/g, '') // strip leading/trailing junk
    .trim();
}

/** "YYYY-MM-DD[anything]" → "DD.MM.YYYY" — strict ISO prefix, ignores time/zone suffix. */
function formatBirthDate(/** @type {string} */ iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

/** Returns dm ("DD.MM.") and yy (exactly 2 digits, e.g. "26") for U__ lines. */
function todayParts() {
  const now = new Date();
  const dd  = String(now.getDate()).padStart(2, '0');
  const mm  = String(now.getMonth() + 1).padStart(2, '0');
  const yy  = String(now.getFullYear()).slice(-2);
  return { dm: `${dd}.${mm}.`, yy };
}

/** "DD.MM.YYYY HH:MM:SS" live timestamp. */
function formatDateTime() {
  const now  = new Date();
  const dd   = String(now.getDate()).padStart(2, '0');
  const mm   = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  const HH   = String(now.getHours()).padStart(2, '0');
  const MM   = String(now.getMinutes()).padStart(2, '0');
  const SS   = String(now.getSeconds()).padStart(2, '0');
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
 *   obrasci/zahtjev_prazan.pdf       blank HKS form
 *   pecati/zig_prozirni.png.png      transparent club stamp (PNG)
 *   pecati/ivan_potpis.png.png       signature (PNG)
 *   fonts/NotoSans-Regular.ttf       optional; enables Croatian diacritics
 *   fonts/NotoSans-Bold.ttf          optional; bold variant for member fields
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

  /**
   * Attempt to load a font buffer: Supabase first, then public/fonts/ via fetch.
   * Returns null if both sources fail.
   * @param {string} supabasePath
   * @param {string} publicFontPath  e.g. '/fonts/Roboto-Bold.woff'
   * @returns {Promise<ArrayBuffer | null>}
   */
  async function tryFontBytes(supabasePath, publicFontPath) {
    try {
      return await fetchStorageFile(supabase, BUCKET, supabasePath);
    } catch { /* Supabase unavailable — try public folder */ }
    try {
      const res = await fetch(publicFontPath);
      if (res.ok) return await res.arrayBuffer();
    } catch { /* Public font also missing */ }
    return null;
  }

  // Load Unicode-capable fonts. NEVER fall back to StandardFonts (WinAnsi — no HR diacritics).
  const regBytes  = await tryFontBytes('fonts/NotoSans-Regular.ttf', '/fonts/Roboto-Regular.woff');
  const boldBytes = await tryFontBytes('fonts/NotoSans-Bold.ttf',    '/fonts/Roboto-Bold.woff');

  if (!regBytes) throw new Error('No Unicode-capable regular font found (Supabase + local both failed).');

  const fontRegular = await pdfDoc.embedFont(regBytes);
  // If bold font unavailable use regular — same charset, avoids WinAnsi crash.
  const fontBold    = boldBytes ? await pdfDoc.embedFont(boldBytes) : fontRegular;

  const zigImage    = await pdfDoc.embedPng(zigBytes);
  const potpisImage = await pdfDoc.embedPng(potpisBytes);
  const page        = pdfDoc.getPages()[0];

  /** Draw helper for regular body text. */
  const draw = (/** @type {string} */ key, /** @type {string} */ text) => {
    const cleaned = sanitize(text);
    if (!cleaned) return;
    const { x, y } = (/** @type {any} */ (COORDS))[key];
    page.drawText(cleaned, { x, y, size: BODY_FONT_SIZE, font: fontRegular, color: TEXT_COLOR });
  };

  /** Draw bold member data field, horizontally centered around COORDS[key].x. */
  const drawBold = (/** @type {string} */ key, /** @type {string} */ text) => {
    const cleaned = sanitize(text);
    if (!cleaned) return;
    const { x: centerX, y } = (/** @type {any} */ (COORDS))[key];
    const textWidth = fontBold.widthOfTextAtSize(cleaned, MEMBER_FONT_SIZE);
    page.drawText(cleaned, {
      x: centerX - textWidth / 2,
      y,
      size: MEMBER_FONT_SIZE,
      font: fontBold,
      color: TEXT_COLOR,
    });
  };

  // ── member data (bold, 11pt) ──────────────────────────────────────
  const fullName = `${member.firstName.toUpperCase()} ${member.lastName.toUpperCase()}`;

  drawBold('imePrezime',    fullName);
  drawBold('datumRodjenja', member.birthDate ? formatBirthDate(member.birthDate) : '');
  drawBold('oib',           member.oib ?? '');

  const mjesto = sanitize((member.mjestRodjenja ?? '').toUpperCase());
  const drzava = sanitize(member.drzavaRodjenja ?? '');
  drawBold('mjestRodjenja', drzava ? `${mjesto}, ${drzava}` : mjesto);

  // ── printed name below member signature line (regular, 9pt) ──────
  draw('imePrezimePrint', fullName);

  // ── bottom blocks (regular, 9pt) ──────────────────────────────────
  const { dm, yy } = todayParts();
  draw('clanGrad',    'Đurđevcu');
  draw('clanDatumDM', dm);
  draw('clanDatumYY', yy);

  draw('klubGrad',    'Đurđevcu');
  draw('klubDatumDM', dm);
  draw('klubDatumYY', yy);

  // ── cover and replace baked-in timestamp ─────────────────────────
  page.drawRectangle({ x: 43, y: 47, width: 320, height: 13, color: WHITE });
  draw('datumIspisa', `Datum i vrijeme ispisa: ${formatDateTime()}`);

  // ── stamp ─────────────────────────────────────────────────────────
  page.drawImage(zigImage, {
    x:       COORDS.zig.x,
    y:       COORDS.zig.y,
    width:   COORDS.zig.width,
    height:  COORDS.zig.height,
    opacity: 0.85,
  });

  // ── signature ─────────────────────────────────────────────────────
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
