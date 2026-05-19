import Stripe from 'stripe';

/**
 * Pinned API version. CPM (Custom Payment Method) requires `2025-03-31.basil`
 * or later — we pin it now so the version is identical across the demo site
 * and the adapter service.
 */
export const STRIPE_API_VERSION = '2025-03-31.basil' as const;

let cached: Stripe | undefined;

/**
 * Server-side Stripe client. Lazily constructed so importing this module in
 * a route that doesn't need Stripe doesn't blow up at module-load time when
 * the secret key is missing in some environments (e.g. preview builds).
 */
export function getStripe(): Stripe {
  if (cached) return cached;
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    throw new Error(
      'STRIPE_SECRET_KEY is not set. Copy .env.example to .env.local and add your test key.',
    );
  }
  cached = new Stripe(secret, {
    apiVersion: STRIPE_API_VERSION as Stripe.StripeConfig['apiVersion'],
  });
  return cached;
}
