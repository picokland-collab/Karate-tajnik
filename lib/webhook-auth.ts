import { NextRequest } from 'next/server';

export function isValidWebhookSecret(req: NextRequest): boolean {
  const secret =
    req.headers.get('x-webhook-secret') ??
    req.headers.get('authorization')?.replace('Bearer ', '');
  return !!secret && secret === process.env.WEBHOOK_SECRET;
}

export function unauthorizedResponse() {
  return Response.json(
    { error: 'Unauthorized — X-Webhook-Secret header is missing or invalid.' },
    { status: 401 }
  );
}
