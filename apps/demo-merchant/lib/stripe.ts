import Stripe from 'stripe';

let cached: Stripe | undefined;

/**
 * Server-side Stripe client. Lazily constructed so importing this module in
 * a route that doesn't need Stripe doesn't blow up at module-load time when
 * the secret key is missing in some environments (e.g. preview builds).
 *
 * Uses the SDK's built-in default API version (deterministic per SDK
 * version, pinned in package.json + lockfile).
 */
export function getStripe(): Stripe {
  if (cached) return cached;
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    throw new Error(
      'STRIPE_SECRET_KEY is not set. Copy .env.example to .env.local and add your test key.',
    );
  }
  cached = new Stripe(secret);
  return cached;
}
