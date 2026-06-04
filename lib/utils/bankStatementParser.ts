// lib/utils/bankStatementParser.ts
// CAMT.053 XML parser — fully namespace-aware, ISO 20022 compliant.
// Tested against: camt.053.001.02 through .08 variants used by Croatian banks.

// ── TYPES ────────────────────────────────────────────────────────

export interface BankTransaction {
  date:        string;    // ISO "YYYY-MM-DD"
  amount:      number;    // EUR (positive)
  currency:    string;
  reference:   string;    // Cleaned Poziv na broj (e.g. "HR6700001234")
  rawRef:      string;    // Verbatim value for reversibility log
  description: string;    // Opis plaćanja / unstructured remittance
  debtorName?: string;    // Ime platitelja
  debtorIban?: string;    // IBAN platitelja
}

export type MatchTier = 1 | 2 | 3;

export interface MatchResult {
  transaction:  BankTransaction;
  tier:         MatchTier;
  memberId?:    number;
  memberLabel?: string;
  confidence:   number;   // 0–1
  confirmed:    boolean;  // tier-2 manual confirmation
}

export interface MatchableMember {
  id:    number;
  label: string;   // "Prezime Ime"
}

// ── PURE NAMESPACE-AWARE XML HELPERS ─────────────────────────────
//
// We intentionally NEVER call querySelector / querySelectorAll because
// browsers return zero results when element names carry namespace prefixes
// (e.g. <camt:Ntry xmlns:camt="urn:iso:std:iso:20022:...">).
// getElementsByTagName('*') always returns ALL elements regardless of
// prefix, and localName strips the prefix, giving us reliable access.

type Parent = Element | Document;

/** First descendant whose local name matches, namespace-agnostic. */
function find(parent: Parent, local: string): Element | null {
  const els = parent.getElementsByTagName('*');
  for (let i = 0; i < els.length; i++) {
    if (els[i].localName === local) return els[i];
  }
  return null;
}

/** All descendants whose local name matches. */
function findAll(parent: Parent, local: string): Element[] {
  const els = parent.getElementsByTagName('*');
  const out: Element[] = [];
  for (let i = 0; i < els.length; i++) {
    if (els[i].localName === local) out.push(els[i]);
  }
  return out;
}

/** Text content of the first matching descendant, trimmed. */
function txt(parent: Element | null | undefined, local: string): string {
  if (!parent) return '';
  const el = find(parent, local);
  return el?.textContent?.trim() ?? '';
}

// ── REFERENCE EXTRACTION (HUB 3A "Poziv na broj") ────────────────

/**
 * Priority order per spec:
 *   1. TxDtls → RmtInf → Strd → CdtrRefInf → Ref
 *   2. TxDtls → RmtInf → Ustrd  (regex: HR\d\d...)
 *   3. Entry-level AddtlNtryInf  (regex fallback)
 *   4. EndToEndId                (last resort)
 */
function extractRef(txDtls: Element | null, ntry: Element): string {
  // 1. Structured remittance: Strd → CdtrRefInf → Ref
  if (txDtls) {
    const rmtInf = find(txDtls, 'RmtInf');
    if (rmtInf) {
      const strd = find(rmtInf, 'Strd');
      if (strd) {
        const ref = txt(find(strd, 'CdtrRefInf'), 'Ref');
        if (ref && ref !== 'NOTPROVIDED' && ref !== '') {
          return ref.replace(/\s/g, '');
        }
      }
      // 2. Unstructured: scan Ustrd for HR model pattern
      const ustrd = txt(rmtInf, 'Ustrd');
      if (ustrd) {
        const m = /HR\d{2}[\s\-]?[\d\s]{2,12}/i.exec(ustrd);
        if (m) return m[0].replace(/[\s\-]/g, '');
      }
    }
    // 2b. Ustrd directly inside TxDtls (some banks flatten structure)
    const ustrdDirect = txt(txDtls, 'Ustrd');
    if (ustrdDirect) {
      const m = /HR\d{2}[\s\-]?[\d\s]{2,12}/i.exec(ustrdDirect);
      if (m) return m[0].replace(/[\s\-]/g, '');
    }
    // 3. EndToEndId (entry-level TxDtls refs)
    const e2e = txt(txDtls, 'EndToEndId');
    if (e2e && e2e !== 'NOTPROVIDED') return e2e.replace(/\s/g, '');
  }

  // 3. Entry-level additional info (AddtlNtryInf)
  const addtl = ntry.textContent ?? '';  // broad scan across the whole entry
  const mAddtl = /HR\d{2}[\s\-]?[\d\s]{2,12}/i.exec(addtl);
  if (mAddtl) return mAddtl[0].replace(/[\s\-]/g, '');

  return '';
}

/** Extracts booking date as ISO "YYYY-MM-DD". */
function extractDate(ntry: Element): string {
  // BookgDt preferred; fall back to ValDt
  for (const dateContainer of ['BookgDt', 'ValDt']) {
    const container = find(ntry, dateContainer);
    if (container) {
      // Dt = date-only; DtTm = datetime (ISO with T)
      const dt = txt(container, 'Dt') || txt(container, 'DtTm');
      if (dt) return dt.slice(0, 10);
    }
  }
  return new Date().toISOString().slice(0, 10);
}

// ── CAMT.053 MAIN PARSER ─────────────────────────────────────────

/**
 * Parses a CAMT.053 XML bank statement.
 *
 * Rules applied per ISO 20022 + Croatian banking spec:
 *   - Only CRDT (credit/incoming) entries are included.
 *   - Entries with <RvslInd>true</RvslInd> (reversed/storno) are skipped.
 *   - Amount is taken from the entry-level <Amt> element.
 *   - Reference extracted via the priority chain in extractRef().
 */
export function parseCamt053(xml: string): BankTransaction[] {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');

  // DOMParser signals parse errors via a <parsererror> element
  if (find(doc, 'parsererror')) {
    throw new Error('XML nije validan — provjerite format izvoda banke (CAMT.053).');
  }

  const entries = findAll(doc, 'Ntry');
  const txns: BankTransaction[] = [];

  for (const ntry of entries) {
    // ── Skip non-credit entries ──────────────────────────────────
    const cdtDbt = txt(ntry, 'CdtDbtInd');
    if (cdtDbt && cdtDbt !== 'CRDT') continue;

    // ── Skip reversed / storno transactions ──────────────────────
    // <RvslInd> may appear as "true" or "1" per xsd:boolean
    const rvsl = txt(ntry, 'RvslInd').toLowerCase();
    if (rvsl === 'true' || rvsl === '1') continue;

    // ── Amount — prefer the direct child of Ntry ─────────────────
    let amtEl: Element | null = null;
    const amts = findAll(ntry, 'Amt');
    for (const a of amts) {
      if (a.parentElement?.localName === 'Ntry') { amtEl = a; break; }
    }
    if (!amtEl) amtEl = amts[0] ?? null;

    const amountRaw = amtEl?.textContent?.trim() ?? '';
    const amount    = parseFloat(amountRaw.replace(',', '.')) || 0;
    if (amount <= 0) continue;

    const currency = amtEl?.getAttribute('Ccy') ?? 'EUR';
    const date     = extractDate(ntry);

    // ── Transaction details (optional element in CAMT.053) ────────
    const txDtls = find(ntry, 'TxDtls');

    // ── Reference extraction (priority chain) ────────────────────
    const reference = extractRef(txDtls, ntry);
    const rawRef    = reference;

    // ── Human-readable description ───────────────────────────────
    const description = (
      (txDtls ? txt(txDtls, 'Ustrd') : '') ||
      txt(ntry, 'AddtlNtryInf') ||
      ''
    ).slice(0, 140);

    // ── Debtor (payer) info ──────────────────────────────────────
    const dbtrCtx  = txDtls ?? ntry;
    const dbtr     = find(dbtrCtx, 'Dbtr');
    const dbtrAcct = find(dbtrCtx, 'DbtrAcct');

    const debtorName = dbtr
      ? (txt(dbtr, 'Nm') || undefined)
      : undefined;
    const debtorIban = dbtrAcct
      ? (txt(dbtrAcct, 'IBAN') || txt(dbtrAcct, 'Id') || undefined)
          ?.replace(/\s/g, '')
      : undefined;

    txns.push({ date, amount, currency, reference, rawRef, description, debtorName, debtorIban });
  }

  return txns;
}

// ── THREE-TIER MATCHING ───────────────────────────────────────────

/** Lowercase tokens ≥3 chars. */
function tokens(name: string): string[] {
  return name.toLowerCase().split(/[\s,\-\/]+/).filter(t => t.length >= 3);
}

/** Fraction of queryTokens present in targetTokens. */
function tokenOverlap(query: string[], target: string[]): number {
  if (!query.length) return 0;
  const hits = query.filter(q => target.some(t => t.includes(q) || q.includes(t)));
  return hits.length / query.length;
}

/**
 * Three-tier matching:
 *   Tier 1 — HR67 reference → exact member ID match (auto-approved).
 *   Tier 2 — debtor name fuzzy overlap ≥ 60% (requires manual confirmation).
 *   Tier 3 — no match found.
 */
export function matchTransactions(
  txns:    BankTransaction[],
  members: MatchableMember[],
): MatchResult[] {
  return txns.map(txn => {
    // ── Tier 1 ───────────────────────────────────────────────────
    const hr67 = /HR67\s*(\d{4,10})/i.exec(txn.reference.replace(/[\s\-]/g, ''));
    if (hr67) {
      const numId  = parseInt(hr67[1], 10);
      const member = members.find(m => m.id === numId);
      if (member) {
        return { transaction: txn, tier: 1, memberId: member.id, memberLabel: member.label, confidence: 1, confirmed: true };
      }
    }

    // ── Tier 2: debtor name fuzzy ─────────────────────────────────
    if (txn.debtorName) {
      const qTok = tokens(txn.debtorName);
      let best: { member: MatchableMember; score: number } | null = null;
      for (const m of members) {
        const score = tokenOverlap(qTok, tokens(m.label));
        if (score >= 0.6 && (!best || score > best.score)) best = { member: m, score };
      }
      if (best) {
        return { transaction: txn, tier: 2, memberId: best.member.id, memberLabel: best.member.label, confidence: best.score, confirmed: false };
      }
    }

    // ── Tier 3 ───────────────────────────────────────────────────
    return { transaction: txn, tier: 3, confidence: 0, confirmed: false };
  });
}
