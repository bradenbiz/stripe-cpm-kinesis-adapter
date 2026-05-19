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
  // DB: D1Database; // uncomment once D1 binding is provisioned
}
