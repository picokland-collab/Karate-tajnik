// Vercel Serverless Function - /api/upload
// Prima Base64 sliku, uploadira na Firebase Storage, vraća URL

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const FB_PROJECT = process.env.FIREBASE_PROJECT_ID || 'digitalni-tajnik';
  const FB_STORAGE_BUCKET = process.env.FIREBASE_STORAGE_BUCKET || `${FB_PROJECT}.appspot.com`;
  const FB_API_KEY = process.env.FIREBASE_API_KEY;

  if (!FB_API_KEY) {
    // Firebase nije konfiguriran - vrati simulirani URL
    return res.status(200).json({ url: null, message: 'Firebase Storage nije konfiguriran' });
  }

  try {
    const { base64, path } = req.body;
    if (!base64 || !path) return res.status(400).json({ error: 'base64 and path required' });

    // Pretvori Base64 u Buffer
    const matches = base64.match(/^data:(.+);base64,(.+)$/);
    if (!matches) return res.status(400).json({ error: 'Invalid base64' });

    const mimeType = matches[1];
    const buffer = Buffer.from(matches[2], 'base64');
    const encodedPath = encodeURIComponent(path);

    // Upload na Firebase Storage REST API
    const uploadUrl = `https://firebasestorage.googleapis.com/v0/b/${FB_STORAGE_BUCKET}/o/${encodedPath}?uploadType=media&key=${FB_API_KEY}`;
    const r = await fetch(uploadUrl, {
      method: 'POST',
      headers: { 'Content-Type': mimeType },
      body: buffer
    });

    if (!r.ok) {
      const err = await r.text();
      return res.status(r.status).json({ error: err });
    }

    const data = await r.json();
    const url = `https://firebasestorage.googleapis.com/v0/b/${FB_STORAGE_BUCKET}/o/${encodedPath}?alt=media&token=${data.downloadTokens}`;
    return res.status(200).json({ url });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
