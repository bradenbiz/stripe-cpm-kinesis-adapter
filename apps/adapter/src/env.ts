/**
 * Cloudflare Worker environment bindings.
 *
 * Secrets are set with `wrangler secret put <NAME>` for production
 * and via `.dev.vars` for local development.
 */
export interface Env {
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  KINESIS_WEBHOOK_SECRET: string;
  // DB: D1Database; // uncomment once D1 binding is provisioned
}
