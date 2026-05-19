import Stripe from 'stripe';

/**
 * The Stripe API version pinned for this adapter.
 *
 * The CPM (Custom Payment Method) feature requires `2025-03-31.basil` or later.
 * See: https://docs.stripe.com/upgrades#2025-03-31.basil
 */
export const STRIPE_API_VERSION = '2025-03-31.basil' as const;

/**
 * Construct a Stripe client suitable for the Cloudflare Workers runtime.
 *
 * Notes:
 *  - `createFetchHttpClient` is mandatory — the default Node http client is
 *    unavailable in Workers.
 *  - Webhook signature verification must use `constructEventAsync` paired
 *    with `createSubtleCryptoProvider` (see `verifyStripeWebhook` below).
 *    The synchronous variants rely on Node `crypto`.
 */
export function makeStripe(secretKey: string): Stripe {
  return new Stripe(secretKey, {
    // The Stripe Node SDK ships typed API version strings; cast lets us pin
    // to a value the SDK may not yet recognise in its own union type.
    apiVersion: STRIPE_API_VERSION as Stripe.StripeConfig['apiVersion'],
    httpClient: Stripe.createFetchHttpClient(),
  });
}

/**
 * Verify a Stripe webhook signature using Web Crypto.
 *
 * Returns the parsed event on success, or throws `Stripe.errors.StripeSignatureVerificationError`
 * if the signature does not validate.
 */
export async function verifyStripeWebhook(
  stripe: Stripe,
  rawBody: string,
  signatureHeader: string,
  webhookSecret: string,
): Promise<Stripe.Event> {
  return stripe.webhooks.constructEventAsync(
    rawBody,
    signatureHeader,
    webhookSecret,
    undefined,
    Stripe.createSubtleCryptoProvider(),
  );
}
