import type { Env } from '../env.js';
import { verifyKinesisWebhook } from '../lib/kinesis-webhook.js';
import { json, text } from '../lib/response.js';

/**
 * POST /webhook/kinesis
 *
 * Stub. Future handler updates the payment state machine and
 * acks the Stripe Payment Record on `payment.succeeded`.
 *
 * Today: verify the HMAC signature (so the verification path is exercised
 * end-to-end) and return 200.
 */
export async function handleKinesisWebhook(request: Request, env: Env): Promise<Response> {
  const signature = request.headers.get('x-kinesis-signature');
  if (!signature) {
    return text('missing x-kinesis-signature header', { status: 400 });
  }

  const rawBody = await request.text();
  const ok = await verifyKinesisWebhook(rawBody, signature, env.KINESIS_WEBHOOK_SECRET);
  if (!ok) {
    console.warn('[webhook-kinesis] signature verification failed');
    return text('signature verification failed', { status: 400 });
  }

  console.log('[webhook-kinesis] verified', { bytes: rawBody.length });
  return json({ received: true });
}
