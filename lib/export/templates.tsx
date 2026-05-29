import React from 'react';
import {
  Document, Page, Text, View, StyleSheet, Font,
} from '@react-pdf/renderer';
import { renderToBuffer } from '@react-pdf/renderer';
import type { Member } from '@/lib/types';
import type { Sjednica } from '@/lib/queries/sjednice';

Font.register({
  family: 'Roboto',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Mu4mxP.ttf' },
    { src: 'https://fonts.gstatic.com/s/roboto/v30/KFOlCnqEu92Fr1MmEU9fBBc9.ttf', fontWeight: 700 },
  ],
});

const RED    = '#c0392b';
const DARK   = '#1e293b';
const GRAY   = '#64748b';
const LGRAY  = '#f8fafc';
const BORDER = '#e2e8f0';
const WHITE  = '#ffffff';
const GREEN  = '#15803d';
const AMBER  = '#b45309';
const DANGER = '#b91c1c';

const s = StyleSheet.create({
  page: {
    fontFamily: 'Roboto',
    fontSize: 10,
    color: DARK,
    paddingTop: 52,
    paddingBottom: 52,
    paddingHorizontal: 44,
  },
  redBar:        { backgroundColor: RED, height: 4, marginBottom: 14 },
  headerTitle:   { fontSize: 16, fontWeight: 700, color: RED, marginBottom: 2 },
  headerKlub:    { fontSize: 10, color: DARK, marginBottom: 2 },
  headerMeta:    { fontSize: 8, color: GRAY },
  divider:       { borderBottomWidth: 1, borderBottomColor: BORDER, marginVertical: 10 },
  sectionLabel:  { fontSize: 8, fontWeight: 700, color: GRAY, marginBottom: 5, marginTop: 12 },
  summaryRow:    { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: LGRAY, borderRadius: 4, padding: 10, marginTop: 6 },
  summaryItem:   { alignItems: 'center' },
  summaryValue:  { fontSize: 18, fontWeight: 700, color: RED },
  summaryLabel:  { fontSize: 7, color: GRAY, marginTop: 2 },
  thRow:         { flexDirection: 'row', backgroundColor: DARK, paddingVertical: 5, paddingHorizontal: 8 },
  thCell:        { fontSize: 7, fontWeight: 700, color: WHITE },
  tdRow:         { flexDirection: 'row', paddingVertical: 4, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: BORDER },
  tdRowAlt:      { backgroundColor: LGRAY },
  tdCell:        { fontSize: 8, color: DARK },
  footer: {
    position: 'absolute', bottom: 24, left: 44, right: 44,
    flexDirection: 'row', justifyContent: 'space-between',
    borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 5,
  },
  footerText: { fontSize: 7, color: GRAY },
});

// ── HELPERS ───────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('hr-HR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch { return iso; }
}

function isExpired(date: string): boolean {
  return !!date && new Date(date) < new Date();
}

function isExpiringSoon(date: string, days: number): boolean {
  if (!date) return false;
  const d = new Date(date);
  const now = new Date();
  const threshold = new Date();
  threshold.setDate(threshold.getDate() + days);
  return d >= now && d <= threshold;
}

const BELT_HR: Record<string, string> = {
  bijeli: 'Bijeli', žuti: 'Žuti', narančasti: 'Narančasti',
  zeleni: 'Zeleni', plavi: 'Plavi', smeđi: 'Smeđi',
  'crni-1': '1. DAN', 'crni-2': '2. DAN', 'crni-3': '3. DAN',
};
const TIP_HR: Record<string, string> = {
  redovni: 'Redovni', podupiruci: 'Podupiruci', pocasni: 'Pocasni',
};
const CAT_HR: Record<string, string> = {
  mali_karatist: 'Mali karatist', kadet: 'Kadet',
  junior: 'Junior', senior: 'Senior', veteran: 'Veteran',
};

function Footer({ klubNaziv, title }: { klubNaziv: string; title: string }) {
  return (
    <View style={s.footer} fixed>
      <Text style={s.footerText}>{klubNaziv} — {title}</Text>
      <Text style={s.footerText}>
        Generirano: {new Date().toLocaleDateString('hr-HR')} | Digitalni tajnik
      </Text>
    </View>
  );
}

function Header({ title, subtitle, klubNaziv }: { title: string; subtitle: string; klubNaziv: string }) {
  return (
    <View>
      <View style={s.redBar} />
      <Text style={s.headerTitle}>{title}</Text>
      <Text style={s.headerKlub}>{klubNaziv}</Text>
      <Text style={s.headerMeta}>
        {subtitle} · Generirano: {new Date().toLocaleDateString('hr-HR')}
      </Text>
      <View style={s.divider} />
    </View>
  );
}

// ── CLANOVI PDF ───────────────────────────────────────────────

function ClanoviDoc({ clanovi, klubNaziv }: { clanovi: Member[]; klubNaziv: string }) {
  const aktivni   = clanovi.filter(c => c.status === 'aktivan').length;
  const neaktivni = clanovi.length - aktivni;
  const gdpr      = clanovi.filter(c => c.consentSigned).length;

  return (
    <Document title={`Popis clanova — ${klubNaziv}`} author="Digitalni tajnik">
      <Page size="A4" orientation="landscape" style={s.page}>
        <Header
          title="Popis clanova"
          subtitle={`Ukupno: ${clanovi.length} · Aktivnih: ${aktivni} · Neaktivnih: ${neaktivni}`}
          klubNaziv={klubNaziv}
        />

        <View style={s.summaryRow}>
          {[
            { v: String(clanovi.length), l: 'Ukupno' },
            { v: String(aktivni),        l: 'Aktivnih' },
            { v: String(neaktivni),      l: 'Neaktivnih' },
            { v: String(gdpr),           l: 'GDPR privola' },
          ].map(({ v, l }) => (
            <View key={l} style={s.summaryItem}>
              <Text style={s.summaryValue}>{v}</Text>
              <Text style={s.summaryLabel}>{l}</Text>
            </View>
          ))}
        </View>

        <Text style={s.sectionLabel}>POPIS SVIH CLANOVA</Text>

        <View style={s.thRow}>
          {[
            { label: '#',            w: '4%'  },
            { label: 'Ime i prezime', w: '18%' },
            { label: 'Datum rod.',    w: '10%' },
            { label: 'Kategorija',    w: '14%' },
            { label: 'Pojas',         w: '12%' },
            { label: 'Tip clanstva',  w: '12%' },
            { label: 'Datum ucl.',    w: '10%' },
            { label: 'Status',        w: '10%' },
            { label: 'GDPR',          w: '10%' },
          ].map(({ label, w }) => (
            <Text key={label} style={[s.thCell, { width: w }]}>{label}</Text>
          ))}
        </View>

        {clanovi.map((m, i) => (
          <View key={m.id} style={[s.tdRow, i % 2 === 1 ? s.tdRowAlt : {}]}>
            <Text style={[s.tdCell, { width: '4%', color: GRAY }]}>{i + 1}</Text>
            <Text style={[s.tdCell, { width: '18%', fontWeight: 700 }]}>{m.firstName} {m.lastName}</Text>
            <Text style={[s.tdCell, { width: '10%' }]}>{fmtDate(m.birthDate)}</Text>
            <Text style={[s.tdCell, { width: '14%' }]}>{CAT_HR[m.category] ?? m.category}</Text>
            <Text style={[s.tdCell, { width: '12%' }]}>{BELT_HR[m.belt] ?? m.belt}</Text>
            <Text style={[s.tdCell, { width: '12%' }]}>{TIP_HR[m.tipClanstva ?? 'redovni']}</Text>
            <Text style={[s.tdCell, { width: '10%' }]}>{fmtDate(m.memberSince)}</Text>
            <Text style={[s.tdCell, { width: '10%', color: m.status === 'aktivan' ? GREEN : DANGER }]}>
              {m.status === 'aktivan' ? 'Aktivan' : m.status === 'neaktivan' ? 'Neaktivan' : 'Suspend.'}
            </Text>
            <Text style={[s.tdCell, { width: '10%', color: m.consentSigned ? GREEN : DANGER }]}>
              {m.consentSigned ? 'Potpisano' : 'Nedostaje'}
            </Text>
          </View>
        ))}

        <Footer klubNaziv={klubNaziv} title="Popis clanova" />
      </Page>
    </Document>
  );
}

// ── GDPR PDF ──────────────────────────────────────────────────

function GdprDoc({ clanovi, klubNaziv }: { clanovi: Member[]; klubNaziv: string }) {
  const potpisani   = clanovi.filter(c => c.consentSigned);
  const nepotpisani = clanovi.filter(c => !c.consentSigned);
  const pct = Math.round(potpisani.length / Math.max(clanovi.length, 1) * 100);

  return (
    <Document title={`GDPR privole — ${klubNaziv}`} author="Digitalni tajnik">
      <Page size="A4" style={s.page}>
        <Header
          title="GDPR — Status privola"
          subtitle={`Potpisano: ${potpisani.length}/${clanovi.length} · Nedostaje: ${nepotpisani.length}`}
          klubNaziv={klubNaziv}
        />

        <View style={s.summaryRow}>
          {[
            { v: String(clanovi.length),       l: 'Ukupno clanova' },
            { v: String(potpisani.length),     l: 'Privola potpisana' },
            { v: String(nepotpisani.length),   l: 'Privola nedostaje' },
            { v: `${pct}%`,                    l: 'Postotak uskladenosti' },
          ].map(({ v, l }) => (
            <View key={l} style={s.summaryItem}>
              <Text style={[s.summaryValue, { color: l === 'Privola nedostaje' && nepotpisani.length > 0 ? DANGER : RED }]}>{v}</Text>
              <Text style={s.summaryLabel}>{l}</Text>
            </View>
          ))}
        </View>

        {nepotpisani.length > 0 && (
          <>
            <Text style={[s.sectionLabel, { color: DANGER }]}>
              PRIVOLA NEDOSTAJE ({nepotpisani.length})
            </Text>
            <View style={s.thRow}>
              <Text style={[s.thCell, { width: '40%' }]}>Ime i prezime</Text>
              <Text style={[s.thCell, { width: '25%' }]}>Kategorija</Text>
              <Text style={[s.thCell, { width: '25%' }]}>Status</Text>
              <Text style={[s.thCell, { width: '10%' }]}>Skrbnik</Text>
            </View>
            {nepotpisani.map((m, i) => (
              <View key={m.id} style={[s.tdRow, i % 2 === 1 ? s.tdRowAlt : {}]}>
                <Text style={[s.tdCell, { width: '40%', fontWeight: 700, color: DANGER }]}>{m.firstName} {m.lastName}</Text>
                <Text style={[s.tdCell, { width: '25%' }]}>{CAT_HR[m.category] ?? m.category}</Text>
                <Text style={[s.tdCell, { width: '25%' }]}>{m.status}</Text>
                <Text style={[s.tdCell, { width: '10%' }]}>{m.guardian ? 'Da' : '—'}</Text>
              </View>
            ))}
          </>
        )}

        <Text style={s.sectionLabel}>POTPISANE PRIVOLE ({potpisani.length})</Text>
        <View style={s.thRow}>
          <Text style={[s.thCell, { width: '45%' }]}>Ime i prezime</Text>
          <Text style={[s.thCell, { width: '30%' }]}>Kategorija</Text>
          <Text style={[s.thCell, { width: '25%' }]}>Datum uclanjenja</Text>
        </View>
        {potpisani.map((m, i) => (
          <View key={m.id} style={[s.tdRow, i % 2 === 1 ? s.tdRowAlt : {}]}>
            <Text style={[s.tdCell, { width: '45%' }]}>{m.firstName} {m.lastName}</Text>
            <Text style={[s.tdCell, { width: '30%' }]}>{CAT_HR[m.category] ?? m.category}</Text>
            <Text style={[s.tdCell, { width: '25%' }]}>{fmtDate(m.memberSince)}</Text>
          </View>
        ))}

        <Footer klubNaziv={klubNaziv} title="GDPR privole" />
      </Page>
    </Document>
  );
}

// ── LIJECNICKI PDF ────────────────────────────────────────────

function LijecnickiDoc({ clanovi, klubNaziv }: { clanovi: Member[]; klubNaziv: string }) {
  const aktivni  = clanovi.filter(c => c.status === 'aktivan');
  const istekli  = aktivni.filter(c => isExpired(c.medicalExpiry));
  const uskoro   = aktivni.filter(c => !isExpired(c.medicalExpiry) && isExpiringSoon(c.medicalExpiry, 60));
  const valjani  = aktivni.filter(c => c.medicalExpiry && !isExpired(c.medicalExpiry) && !isExpiringSoon(c.medicalExpiry, 60));
  const bezDat   = aktivni.filter(c => !c.medicalExpiry);

  return (
    <Document title={`Lijecnicki pregledi — ${klubNaziv}`} author="Digitalni tajnik">
      <Page size="A4" style={s.page}>
        <Header
          title="Lijecnicki pregledi"
          subtitle={`Aktivnih clanova: ${aktivni.length} · Isteklo: ${istekli.length} · Uskoro istjece: ${uskoro.length}`}
          klubNaziv={klubNaziv}
        />

        <View style={s.summaryRow}>
          {[
            { v: String(istekli.length), l: 'Isteklo',               color: DANGER },
            { v: String(uskoro.length),  l: 'Uskoro istjece (60d)', color: AMBER  },
            { v: String(valjani.length), l: 'Valjano',               color: GREEN  },
            { v: String(bezDat.length),  l: 'Bez evidencije',        color: GRAY   },
          ].map(({ v, l, color }) => (
            <View key={l} style={s.summaryItem}>
              <Text style={[s.summaryValue, { color }]}>{v}</Text>
              <Text style={s.summaryLabel}>{l}</Text>
            </View>
          ))}
        </View>

        {istekli.length > 0 && (
          <>
            <Text style={[s.sectionLabel, { color: DANGER }]}>ISTEKLI PREGLEDI — HITNO ({istekli.length})</Text>
            <View style={s.thRow}>
              <Text style={[s.thCell, { width: '45%' }]}>Ime i prezime</Text>
              <Text style={[s.thCell, { width: '30%' }]}>Datum isteka</Text>
              <Text style={[s.thCell, { width: '25%' }]}>Kategorija</Text>
            </View>
            {istekli.map((m, i) => (
              <View key={m.id} style={[s.tdRow, i % 2 === 1 ? s.tdRowAlt : {}]}>
                <Text style={[s.tdCell, { width: '45%', fontWeight: 700, color: DANGER }]}>{m.firstName} {m.lastName}</Text>
                <Text style={[s.tdCell, { width: '30%', color: DANGER }]}>{fmtDate(m.medicalExpiry)}</Text>
                <Text style={[s.tdCell, { width: '25%' }]}>{CAT_HR[m.category] ?? m.category}</Text>
              </View>
            ))}
          </>
        )}

        {uskoro.length > 0 && (
          <>
            <Text style={[s.sectionLabel, { color: AMBER }]}>ISTJECE U 60 DANA ({uskoro.length})</Text>
            <View style={s.thRow}>
              <Text style={[s.thCell, { width: '45%' }]}>Ime i prezime</Text>
              <Text style={[s.thCell, { width: '30%' }]}>Datum isteka</Text>
              <Text style={[s.thCell, { width: '25%' }]}>Kategorija</Text>
            </View>
            {uskoro.map((m, i) => (
              <View key={m.id} style={[s.tdRow, i % 2 === 1 ? s.tdRowAlt : {}]}>
                <Text style={[s.tdCell, { width: '45%' }]}>{m.firstName} {m.lastName}</Text>
                <Text style={[s.tdCell, { width: '30%', color: AMBER }]}>{fmtDate(m.medicalExpiry)}</Text>
                <Text style={[s.tdCell, { width: '25%' }]}>{CAT_HR[m.category] ?? m.category}</Text>
              </View>
            ))}
          </>
        )}

        {valjani.length > 0 && (
          <>
            <Text style={[s.sectionLabel, { color: GREEN }]}>VALJANI PREGLEDI ({valjani.length})</Text>
            <View style={s.thRow}>
              <Text style={[s.thCell, { width: '45%' }]}>Ime i prezime</Text>
              <Text style={[s.thCell, { width: '30%' }]}>Vrijedi do</Text>
              <Text style={[s.thCell, { width: '25%' }]}>Kategorija</Text>
            </View>
            {valjani.map((m, i) => (
              <View key={m.id} style={[s.tdRow, i % 2 === 1 ? s.tdRowAlt : {}]}>
                <Text style={[s.tdCell, { width: '45%' }]}>{m.firstName} {m.lastName}</Text>
                <Text style={[s.tdCell, { width: '30%', color: GREEN }]}>{fmtDate(m.medicalExpiry)}</Text>
                <Text style={[s.tdCell, { width: '25%' }]}>{CAT_HR[m.category] ?? m.category}</Text>
              </View>
            ))}
          </>
        )}

        <Footer klubNaziv={klubNaziv} title="Lijecnicki pregledi" />
      </Page>
    </Document>
  );
}

// ── SKUPSTINE PDF ─────────────────────────────────────────────

function SkupstineDoc({ sjednice, klubNaziv }: { sjednice: Sjednica[]; klubNaziv: string }) {
  const zavrsene  = sjednice.filter(s => s.status === 'zavrsena').length;
  const planirane = sjednice.filter(s => s.status === 'planirana').length;

  return (
    <Document title={`Skupstine — ${klubNaziv}`} author="Digitalni tajnik">
      <Page size="A4" style={s.page}>
        <Header
          title="Skupstine i sjednice"
          subtitle={`Ukupno: ${sjednice.length} · Zavrsenih: ${zavrsene} · Planiranih: ${planirane}`}
          klubNaziv={klubNaziv}
        />

        <View style={s.thRow}>
          <Text style={[s.thCell, { width: '15%' }]}>Datum</Text>
          <Text style={[s.thCell, { width: '18%' }]}>Vrsta</Text>
          <Text style={[s.thCell, { width: '12%' }]}>Status</Text>
          <Text style={[s.thCell, { width: '25%' }]}>Mjesto</Text>
          <Text style={[s.thCell, { width: '30%' }]}>Dnevni red (sazetak)</Text>
        </View>

        {sjednice.map((sj, i) => (
          <View key={sj.id} style={[s.tdRow, i % 2 === 1 ? s.tdRowAlt : {}]}>
            <Text style={[s.tdCell, { width: '15%' }]}>{fmtDate(sj.datum)}</Text>
            <Text style={[s.tdCell, { width: '18%', fontWeight: 700 }]}>
              {sj.vrsta === 'izvanredna' ? 'Izvanredna' : sj.vrsta === 'osnivacka' ? 'Osnivacka' : 'Redovna'}
            </Text>
            <Text style={[s.tdCell, { width: '12%', color: sj.status === 'zavrsena' ? GREEN : sj.status === 'otkazana' ? DANGER : AMBER }]}>
              {sj.status === 'zavrsena' ? 'Zavrsena' : sj.status === 'otkazana' ? 'Otkazana' : 'Planirana'}
            </Text>
            <Text style={[s.tdCell, { width: '25%' }]}>{sj.lokacija}</Text>
            <Text style={[s.tdCell, { width: '30%', color: GRAY }]}>
              {sj.dnevni_red.slice(0, 2).join('; ')}{sj.dnevni_red.length > 2 ? ` (+${sj.dnevni_red.length - 2})` : ''}
            </Text>
          </View>
        ))}

        <Footer klubNaziv={klubNaziv} title="Skupstine" />
      </Page>
    </Document>
  );
}

// ── PUBLIC RENDER FUNCTIONS ───────────────────────────────────

export async function renderClanoviPdf(clanovi: Member[], klubNaziv: string): Promise<Buffer> {
  return renderToBuffer(<ClanoviDoc clanovi={clanovi} klubNaziv={klubNaziv} />);
}

export async function renderGdprPdf(clanovi: Member[], klubNaziv: string): Promise<Buffer> {
  return renderToBuffer(<GdprDoc clanovi={clanovi} klubNaziv={klubNaziv} />);
}

export async function renderLijecnickiPdf(clanovi: Member[], klubNaziv: string): Promise<Buffer> {
  return renderToBuffer(<LijecnickiDoc clanovi={clanovi} klubNaziv={klubNaziv} />);
}

export async function renderSkupstinePdf(sjednice: Sjednica[], klubNaziv: string): Promise<Buffer> {
  return renderToBuffer(<SkupstineDoc sjednice={sjednice} klubNaziv={klubNaziv} />);
}
