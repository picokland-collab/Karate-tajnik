import { NextRequest } from 'next/server';
import { generateNotificationQueue, ackQueueItems } from '@/lib/queries/obavijestiPipeline';
import type { QueueItem } from '@/lib/queries/obavijestiPipeline';

// Secure this endpoint with the same WEBHOOK_SECRET used for n8n webhooks.
// Call it daily via Vercel Cron (vercel.json) or an external scheduler.
// Header required:  X-Cron-Secret: <WEBHOOK_SECRET>
function isAuthorized(req: NextRequest): boolean {
  const secret = req.headers.get('x-cron-secret')
    ?? req.headers.get('x-webhook-secret')
    ?? req.headers.get('authorization')?.replace('Bearer ', '');
  const expected = process.env.WEBHOOK_SECRET;
  return !!expected && !!secret && secret === expected;
}

// ── RESEND EMAIL ──────────────────────────────────────────────

const RESEND_FROM = process.env.RESEND_FROM ?? 'Digitalni tajnik <obavijesti@resend.dev>';

function buildLijecnickiEmail(item: QueueItem): { subject: string; html: string } {
  const { ime, prezime, datum_isteka, klub_naziv } = item.podatci;
  const subject = `⚠️ Liječnički pregled — ${ime} ${prezime} istječe za 30 dana`;
  const html = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px">
  <div style="background:#c0392b;padding:16px 24px;border-radius:8px 8px 0 0">
    <h2 style="color:#fff;margin:0;font-size:18px">Digitalni tajnik — Automatski podsjetnik</h2>
  </div>
  <div style="background:#f8fafc;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;padding:24px">
    <p style="margin:0 0 16px;font-size:15px;color:#1e293b">Poštovani,</p>
    <p style="margin:0 0 16px;font-size:15px;color:#1e293b">
      Obavještavamo vas da liječnički pregled za člana kluba
      <strong>${klub_naziv}</strong> istječe za <strong>30 dana</strong>.
    </p>
    <div style="background:#fff;border:2px solid #fbbf24;border-radius:8px;padding:16px;margin:16px 0">
      <table style="width:100%;border-collapse:collapse">
        <tr><td style="color:#64748b;padding:4px 0;width:40%">Član:</td>
            <td style="font-weight:bold;color:#1e293b">${ime} ${prezime}</td></tr>
        <tr><td style="color:#64748b;padding:4px 0">Istek pregleda:</td>
            <td style="font-weight:bold;color:#c0392b">${new Date(datum_isteka).toLocaleDateString('hr-HR')}</td></tr>
        <tr><td style="color:#64748b;padding:4px 0">Preostalo:</td>
            <td style="font-weight:bold;color:#1e293b">30 dana</td></tr>
      </table>
    </div>
    <p style="margin:16px 0;font-size:14px;color:#475569">
      Molimo pravovremeno zakazati novi liječnički pregled kako bi se izbjegao prekid
      natjecateljske aktivnosti sukladno Zakonu o sportu.
    </p>
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0">
    <p style="margin:0;font-size:12px;color:#94a3b8">
      Digitalni tajnik · Automatski podsjetnik · ${new Date().toLocaleDateString('hr-HR')}
    </p>
  </div>
</div>`;
  return { subject, html };
}

function buildLicencaEmail(item: QueueItem): { subject: string; html: string } {
  const { ime, prezime, datum_isteka, klub_naziv, licenca_vrsta } = item.podatci;
  const subject = `⚠️ HKF Licenca — ${ime} ${prezime} istječe za 90 dana`;
  const html = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px">
  <div style="background:#c0392b;padding:16px 24px;border-radius:8px 8px 0 0">
    <h2 style="color:#fff;margin:0;font-size:18px">Digitalni tajnik — Automatski podsjetnik</h2>
  </div>
  <div style="background:#f8fafc;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;padding:24px">
    <p style="margin:0 0 16px;font-size:15px;color:#1e293b">Poštovani,</p>
    <p style="margin:0 0 16px;font-size:15px;color:#1e293b">
      Obavještavamo vas da HKF trenerska licenca za trenera kluba
      <strong>${klub_naziv}</strong> istječe za <strong>90 dana</strong>.
    </p>
    <div style="background:#fff;border:2px solid #fbbf24;border-radius:8px;padding:16px;margin:16px 0">
      <table style="width:100%;border-collapse:collapse">
        <tr><td style="color:#64748b;padding:4px 0;width:40%">Trener:</td>
            <td style="font-weight:bold;color:#1e293b">${ime} ${prezime}</td></tr>
        <tr><td style="color:#64748b;padding:4px 0">Vrsta licence:</td>
            <td style="font-weight:bold;color:#1e293b">${licenca_vrsta ?? '—'}</td></tr>
        <tr><td style="color:#64748b;padding:4px 0">Istek licence:</td>
            <td style="font-weight:bold;color:#c0392b">${new Date(datum_isteka).toLocaleDateString('hr-HR')}</td></tr>
        <tr><td style="color:#64748b;padding:4px 0">Preostalo:</td>
            <td style="font-weight:bold;color:#1e293b">90 dana</td></tr>
      </table>
    </div>
    <p style="margin:16px 0;font-size:14px;color:#475569">
      Molimo pokrenuti postupak obnove HKF licence pravovremeno kako bi trener
      mogao nastaviti rad sukladno Zakonu o sportu (čl. 25.).
    </p>
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0">
    <p style="margin:0;font-size:12px;color:#94a3b8">
      Digitalni tajnik · Automatski podsjetnik · ${new Date().toLocaleDateString('hr-HR')}
    </p>
  </div>
</div>`;
  return { subject, html };
}

async function sendEmail(
  to: string,
  subject: string,
  html: string,
): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false, error: 'RESEND_API_KEY nije konfiguriran' };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({ from: RESEND_FROM, to: [to], subject, html }),
    });

    if (!res.ok) {
      const body = await res.text();
      return { ok: false, error: `Resend HTTP ${res.status}: ${body}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'fetch error' };
  }
}

// ── CRON HANDLER ──────────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return Response.json(
      { error: 'Unauthorized — X-Cron-Secret header missing or invalid.' },
      { status: 401 }
    );
  }

  const startedAt = new Date().toISOString();
  let newItems = 0;
  let emailsSent = 0;
  let emailsFailed = 0;
  const errors: string[] = [];

  try {
    const items = await generateNotificationQueue();
    newItems = items.length;

    const sentIds: string[] = [];
    const failedIds: string[] = [];

    for (const item of items) {
      // Pick recipient: prefer kontakt_email (admin), fall back to member/trainer email
      const to = item.podatci.kontakt_email ?? item.podatci.email;
      if (!to) {
        // No email address — mark skipped
        failedIds.push(item.id);
        errors.push(`${item.referenca_id}: nema email adrese`);
        continue;
      }

      const { subject, html } = item.vrsta === 'lijecnicki_uskoro_30d'
        ? buildLijecnickiEmail(item)
        : buildLicencaEmail(item);

      const result = await sendEmail(to, subject, html);

      if (result.ok) {
        sentIds.push(item.id);
        emailsSent++;
      } else {
        failedIds.push(item.id);
        emailsFailed++;
        errors.push(`${item.referenca_id}: ${result.error}`);
      }
    }

    // ACK queue items
    await Promise.all([
      ackQueueItems(sentIds, 'sent'),
      ackQueueItems(failedIds, 'failed', errors.join('; ')),
    ]);

  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Nepoznata greška';
    console.error('[cron/obavijesti]', msg);
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }

  const summary = {
    ok:          true,
    startedAt,
    newItems,
    emailsSent,
    emailsFailed,
    errors:      errors.length > 0 ? errors : undefined,
  };

  console.log('[cron/obavijesti]', JSON.stringify(summary));
  return Response.json(summary);
}
