/**
 * Cloudflare Worker environment bindings.
 *
 * Secrets are set with `wrangler secret put <NAME>` for production
 * and via `.dev.vars` for local development.
 */
export interface Env {
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  /** Kept for the dev-only /webhook/kinesis simulator. */
  KINESIS_WEBHOOK_SECRET: string;
  /** Kinesis Pay merchant API credentials (QA env initially). */
  KINESIS_PUBLIC_KEY: string;
  KINESIS_SECRET_KEY: string;
  KINESIS_MERCHANT_ID: string;
  /**
   * The Stripe Custom Payment Method type id (cpmt_…) associated with
   * Kinesis Pay. Used when reporting payments back to Stripe via
   * stripe.paymentRecords.reportPayment. Must match the demo merchant's
   * KINESIS_CPMT_ID — same Stripe account, same cpmt.
   */
  KINESIS_CPMT_ID: string;
  /**
   * Where customers land after paying (the merchant's success page). Set in
   * config, not taken from the request, so links can't redirect elsewhere.
   * Empty disables the redirect.
   */
  MERCHANT_RETURN_URL?: string;
  // DB: D1Database; // uncomment once D1 binding is provisioned
}
