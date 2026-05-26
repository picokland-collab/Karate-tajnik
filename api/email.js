// Vercel Serverless Function - /api/email
// EmailJS credentials are secure on the server, never exposed to the client

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const EMAILJS_SERVICE_ID  = process.env.EMAILJS_SERVICE_ID;
  const EMAILJS_TEMPLATE_ID = process.env.EMAILJS_TEMPLATE_ID;
  const EMAILJS_PUBLIC_KEY  = process.env.EMAILJS_PUBLIC_KEY;
  const EMAILJS_PRIVATE_KEY = process.env.EMAILJS_PRIVATE_KEY;

  if (!EMAILJS_SERVICE_ID || !EMAILJS_TEMPLATE_ID || !EMAILJS_PUBLIC_KEY || !EMAILJS_PRIVATE_KEY) {
    return res.status(500).json({ error: 'Email service not configured' });
  }

  try {
    const { to_email, to_name, subject, message } = req.body;

    if (!to_email) {
      return res.status(400).json({ error: 'to_email is required' });
    }

    const mask = s => s ? s.slice(0, 4) + '...' + s.slice(-4) : '(not set)';
    console.log('Sending payload to EmailJS:', {
      service_id:  EMAILJS_SERVICE_ID,
      template_id: EMAILJS_TEMPLATE_ID,
      user_id:     mask(EMAILJS_PUBLIC_KEY),
      secret_key:  mask(EMAILJS_PRIVATE_KEY),
      template_params: { to_email, to_name: to_name || to_email, subject: subject || '', message: '(omitted)' }
    });

    const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id:  EMAILJS_SERVICE_ID,
        template_id: EMAILJS_TEMPLATE_ID,
        user_id:     EMAILJS_PUBLIC_KEY,
        secret_key:  EMAILJS_PRIVATE_KEY,
        template_params: {
          to_email:     to_email,
          to_name:      to_name  || to_email,
          subject:      subject  || '',
          message:      message  || '',
          email:        to_email,
          ime:          to_name  || to_email,
          naslov:       subject  || '',
          poruka:       message  || '',
          poruka_tijelo: message || ''
        }
      })
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('EmailJS API Rejected:', text);
      return res.status(response.status).json({ error: text || 'EmailJS error' });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};
