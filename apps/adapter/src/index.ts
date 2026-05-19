import type { Env } from './env.js';
// Side-effect import to force the Workers bundler to resolve & bundle the
// Kinesis Pay SDK. Surfaces any Node-only imports or ESM/CJS issues at
// build time, before any route depends on the SDK.
import './lib/kinesis-pay.smoke.js';
import { text } from './lib/response.js';
import { handleHealth } from './routes/health.js';
import { handlePay } from './routes/pay.js';
import { handleKinesisWebhook } from './routes/webhook-kinesis.js';
import { handleStripeWebhook } from './routes/webhook-stripe.js';

/**
 * Route dispatcher.
 *
 * Exported as a named function (not just the default fetch handler) so unit
 * tests can call it with a constructed `Request` and `Env` without spinning
 * up workerd.
 */
export async function handleRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const { pathname } = url;
  const method = request.method.toUpperCase();

  // GET /health
  if (pathname === '/health' && method === 'GET') {
    return handleHealth();
  }

  // GET /pay/:session_id
  const payMatch = pathname.match(/^\/pay\/([^/]+)$/);
  if (payMatch && method === 'GET') {
    // biome-ignore lint/style/noNonNullAssertion: regex group guaranteed by match
    return handlePay(request, decodeURIComponent(payMatch[1]!));
  }

  // POST /webhook/stripe
  if (pathname === '/webhook/stripe' && method === 'POST') {
    return handleStripeWebhook(request, env);
  }

  // POST /webhook/kinesis
  if (pathname === '/webhook/kinesis' && method === 'POST') {
    return handleKinesisWebhook(request, env);
  }

  return text('not found', { status: 404 });
}

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return handleRequest(request, env);
  },
} satisfies ExportedHandler<Env>;
