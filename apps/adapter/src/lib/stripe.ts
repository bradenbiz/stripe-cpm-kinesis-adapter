import Stripe from 'stripe';

/**
 * Construct a Stripe client suitable for the Cloudflare Workers runtime.
 *
 * Notes:
 *  - `createFetchHttpClient` is mandatory — the default Node http client is
 *    unavailable in Workers.
 *  - Webhook signature verification must use `constructEventAsync` paired
 *    with `createSubtleCryptoProvider` (see `verifyStripeWebhook` below).
 *    The synchronous variants rely on Node `crypto`.
 *  - We don't pin `apiVersion` — the SDK uses its built-in latest, which is
 *    deterministic per SDK version (pinned in package.json + lockfile).
 *    Tried explicit pinning previously but the SDK's apiVersion union is a
 *    strict literal type that rejects values outside `LatestApiVersion`,
 *    making cross-SDK-version compatibility fragile.
 */
export function makeStripe(secretKey: string): Stripe {
  return new Stripe(secretKey, {
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
