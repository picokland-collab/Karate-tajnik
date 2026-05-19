// Vercel Serverless Function - /api/emailjs-send
// EmailJS ključevi su sigurni na serveru

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const EJS_SERVICE  = process.env.EMAILJS_SERVICE_ID;
  const EJS_TEMPLATE = process.env.EMAILJS_TEMPLATE_ID;
  const EJS_PUBLIC   = process.env.EMAILJS_PUBLIC_KEY;
  const EJS_PRIVATE  = process.env.EMAILJS_PRIVATE_KEY;

  if (!EJS_SERVICE || !EJS_TEMPLATE || !EJS_PRIVATE) {
    return res.status(500).json({ error: 'EmailJS not configured' });
  }

  try {
    const { to_email, to_name, subject, message, name, email } = req.body;

    const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: EJS_SERVICE,
        template_id: EJS_TEMPLATE,
        user_id: EJS_PUBLIC,
        accessToken: EJS_PRIVATE,
        template_params: { to_email, to_name, subject, message, name, email }
      })
    });

    if (response.ok) {
      return res.status(200).json({ success: true });
    } else {
      const err = await response.text();
      return res.status(400).json({ error: err });
    }
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
}
