import { describe, expect, it } from 'vitest';
import type { Env } from './env.js';
import { handleRequest } from './index.js';

const env: Env = {
  STRIPE_SECRET_KEY: 'sk_test_dummy',
  STRIPE_WEBHOOK_SECRET: 'whsec_dummy',
  KINESIS_WEBHOOK_SECRET: 'kinesis_dummy',
  KINESIS_PUBLIC_KEY: 'kp_pub_dummy',
  KINESIS_SECRET_KEY: 'kp_secret_dummy',
  KINESIS_MERCHANT_ID: 'mer_dummy',
  KINESIS_CPMT_ID: 'cpmt_dummy',
};

describe('adapter router', () => {
  it('GET /health returns ok', async () => {
    const res = await handleRequest(new Request('https://x/health'), env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe('ok');
  });

  // /pay/:id and /pay-status/:id make external Kinesis API calls and are
  // exercised manually (see README for the wrangler dev + curl flow).
  // We only assert routing here — that the routes are mounted and that
  // missing-id variants 404 cleanly without invoking the SDK.

  it('GET /pay (no id) → 404', async () => {
    const res = await handleRequest(new Request('https://x/pay/'), env);
    expect(res.status).toBe(404);
  });

  it('GET /pay-status (no id) → 404', async () => {
    const res = await handleRequest(new Request('https://x/pay-status/'), env);
    expect(res.status).toBe(404);
  });

  it('POST /webhook/stripe with no signature header → 400', async () => {
    const res = await handleRequest(
      new Request('https://x/webhook/stripe', { method: 'POST', body: '{}' }),
      env,
    );
    expect(res.status).toBe(400);
  });

  it('POST /webhook/stripe with bogus signature → 400 (signature verification failed)', async () => {
    const res = await handleRequest(
      new Request('https://x/webhook/stripe', {
        method: 'POST',
        body: '{"id":"evt_test"}',
        headers: { 'stripe-signature': 't=1,v1=deadbeef' },
      }),
      env,
    );
    expect(res.status).toBe(400);
    expect(await res.text()).toMatch(/signature verification failed/i);
  });

  it('POST /webhook/kinesis with no signature header → 400', async () => {
    const res = await handleRequest(
      new Request('https://x/webhook/kinesis', { method: 'POST', body: '{}' }),
      env,
    );
    expect(res.status).toBe(400);
  });

  it('POST /webhook/kinesis with valid HMAC → 200', async () => {
    const body = '{"event":"payment.succeeded","id":"kp_test_1"}';
    const secret = env.KINESIS_WEBHOOK_SECRET;
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const mac = await crypto.subtle.sign('HMAC', key, enc.encode(body));
    const sig = Array.from(new Uint8Array(mac))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    const res = await handleRequest(
      new Request('https://x/webhook/kinesis', {
        method: 'POST',
        body,
        headers: { 'x-kinesis-signature': sig },
      }),
      env,
    );
    expect(res.status).toBe(200);
  });

  it('unknown path → 404', async () => {
    const res = await handleRequest(new Request('https://x/nope'), env);
    expect(res.status).toBe(404);
  });
});
