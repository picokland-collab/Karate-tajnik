// Vercel Serverless Function - /api/firebase
// Firebase API ključ je siguran na serveru u Environment Variables

const FB_PROJECT = process.env.FIREBASE_PROJECT_ID || 'digitalni-tajnik';
const FB_API_KEY = process.env.FIREBASE_API_KEY;
const FB_BASE = `https://firestore.googleapis.com/v1/projects/${FB_PROJECT}/databases/(default)/documents`;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!FB_API_KEY) return res.status(500).json({ error: 'Firebase nije konfiguriran' });

  // Health check
  if (req.url?.includes('/health')) {
    return res.status(200).json({ ok: true });
  }

  try {
    if (req.method === 'GET') {
      // fbGet(collection)
      const { collection } = req.query;
      if (!collection) return res.status(400).json({ error: 'collection required' });
      const r = await fetch(`${FB_BASE}/${collection}?key=${FB_API_KEY}&pageSize=500`);
      if (!r.ok) return res.status(r.status).json({ error: 'Firebase error', documents: [] });
      const data = await r.json();
      // Parse Firestore documents to plain objects
      const documents = (data.documents || []).map(doc => {
        if (!doc.fields) return null;
        const obj = {};
        for (const [k, v] of Object.entries(doc.fields)) {
          if (v.stringValue !== undefined) obj[k] = v.stringValue;
          else if (v.integerValue !== undefined) obj[k] = parseInt(v.integerValue);
          else if (v.doubleValue !== undefined) obj[k] = parseFloat(v.doubleValue);
          else if (v.booleanValue !== undefined) obj[k] = v.booleanValue;
          else if (v.nullValue !== undefined) obj[k] = null;
          else obj[k] = null;
        }
        return obj;
      }).filter(Boolean);
      return res.status(200).json({ documents });
    }

    if (req.method === 'PATCH') {
      // fbSet(collection, id, data)
      const { collection, id, data } = req.body;
      if (!collection || !id) return res.status(400).json({ error: 'collection and id required' });
      // Convert plain object to Firestore fields
      const fields = {};
      for (const [k, v] of Object.entries(data || {})) {
        if (v === null || v === undefined) fields[k] = { nullValue: null };
        else if (typeof v === 'boolean') fields[k] = { booleanValue: v };
        else if (typeof v === 'number') fields[k] = Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
        else if (typeof v === 'string') fields[k] = { stringValue: v };
        else if (Array.isArray(v)) fields[k] = { arrayValue: { values: v.map(i => typeof i === 'string' ? { stringValue: i } : { integerValue: String(i) }) } };
        else fields[k] = { stringValue: JSON.stringify(v) };
      }
      const r = await fetch(`${FB_BASE}/${collection}/${id}?key=${FB_API_KEY}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields })
      });
      return res.status(r.ok ? 200 : r.status).json({ ok: r.ok });
    }

    if (req.method === 'DELETE') {
      // fbDelete(collection, id)
      const { collection, id } = req.body;
      if (!collection || !id) return res.status(400).json({ error: 'collection and id required' });
      await fetch(`${FB_BASE}/${collection}/${id}?key=${FB_API_KEY}`, { method: 'DELETE' });
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch(e) {
    return res.status(500).json({ error: 'Internal server error' });
  }
}
