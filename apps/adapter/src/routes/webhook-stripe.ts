import type { Env } from '../env.js';
import { json, text } from '../lib/response.js';
import { makeStripe, verifyStripeWebhook } from '../lib/stripe.js';

/**
 * POST /webhook/stripe
 *
 * Verify the Stripe webhook signature, log the event, return 200.
 *
 * The signature check runs BEFORE any handler logic so a forged event cannot
 * trigger downstream state changes even by mistake.
 */
export async function handleStripeWebhook(request: Request, env: Env): Promise<Response> {
  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return text('missing stripe-signature header', { status: 400 });
  }

  const rawBody = await request.text();
  const stripe = makeStripe(env.STRIPE_SECRET_KEY);

  try {
    const event = await verifyStripeWebhook(stripe, rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
    console.log('[webhook-stripe] verified', { id: event.id, type: event.type });
    // Real handler dispatches on event.type here.
    return json({ received: true, id: event.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'signature verification failed';
    console.warn('[webhook-stripe] signature verification failed', { message });
    return text(`webhook signature verification failed: ${message}`, { status: 400 });
  }
}
