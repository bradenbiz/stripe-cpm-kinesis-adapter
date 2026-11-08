import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../env.js';
import { handleRequest } from '../index.js';

const env: Env = {
  STRIPE_SECRET_KEY: 'sk_test_dummy',
  STRIPE_WEBHOOK_SECRET: 'whsec_dummy',
  KINESIS_WEBHOOK_SECRET: 'kinesis_dummy',
  KINESIS_PUBLIC_KEY: 'kp_pub_dummy',
  KINESIS_SECRET_KEY: 'kp_secret_dummy',
  KINESIS_MERCHANT_ID: 'mer_dummy',
  KINESIS_CPMT_ID: 'cpmt_dummy',
};

interface World {
  /** The one PaymentIntent Stripe knows about: pi_order. */
  amount: number;
  metadata: Record<string, string>;
  /** Status of every Kinesis payment, by id. */
  kinesis: Record<string, string>;
}

/** Fake Stripe + Kinesis Pay. Returns the list of write calls made. */
function stubApis(world: World) {
  const writes: { url: string; body: string }[] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = (init?.method ?? 'GET').toUpperCase();
    const body = decodeURIComponent(typeof init?.body === 'string' ? init.body : '');
    const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status });
    if (method !== 'GET') writes.push({ url, body });

    const pi = url.match(/api\.stripe\.com\/v1\/payment_intents\/([^/?]+)/)?.[1];
    if (pi) {
      if (pi !== 'pi_order') {
        return json(
          { error: { type: 'invalid_request_error', message: 'No such payment_intent' } },
          404,
        );
      }
      return json({
        id: 'pi_order',
        object: 'payment_intent',
        amount: world.amount,
        currency: 'usd',
        status: 'requires_payment_method',
        created: 1,
        metadata: world.metadata,
      });
    }
    if (url.includes('api.stripe.com')) return json({ id: 'pr_1', object: 'payment_record' });

    const kp = url.match(/\/api\/merchants\/payment\/id\/sdk\/([^/?]+)/)?.[1];
    if (kp) return json({ globalPaymentId: kp, status: world.kinesis[kp] ?? 'expired' });
    if (url.endsWith('/api/merchants/payment'))
      return json({ globalPaymentId: 'KP_NEW', status: 'created' });
    if (url.endsWith('/api/merchants/payment/confirm')) return json({});
    return new Response('unexpected', { status: 500 });
  });
  return writes;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('GET /pay-status/:payment_intent_id', () => {
  it('a processed Kinesis payment named in the URL cannot settle another order', async () => {
    // The old attack: ?pi=<victim order> plus any processed Kinesis id.
    const writes = stubApis({ amount: 50000, metadata: {}, kinesis: { KP_CHEAP: 'processed' } });
    const old = await handleRequest(new Request('https://x/pay-status/KP_CHEAP?pi=pi_order'), env);
    const unbound = await handleRequest(new Request('https://x/pay-status/pi_order'), env);
    expect(old.status).toBe(404);
    expect(unbound.status).toBe(404);
    expect(writes).toEqual([]);
  });

  it('closes out the order with the Kinesis payment bound to it', async () => {
    const writes = stubApis({
      amount: 50000,
      metadata: { kinesis_payment_id: 'KP_BOUND', kinesis_request: '50000 usd' },
      kinesis: { KP_BOUND: 'processed' },
    });
    const res = await handleRequest(new Request('https://x/pay-status/pi_order'), env);
    expect(await res.json()).toMatchObject({ status: 'processed', paymentId: 'KP_BOUND' });
    const update = writes.find((w) => w.url.endsWith('/payment_intents/pi_order'));
    expect(update?.body).toContain('metadata[kinesis_status]=processed');
    expect(update?.body).toContain('metadata[kinesis_payment_id]=KP_BOUND');
  });

  it('refuses to settle an order whose amount changed after the payment was created', async () => {
    const writes = stubApis({
      amount: 50000,
      metadata: { kinesis_payment_id: 'KP_BOUND', kinesis_request: '500 usd' },
      kinesis: { KP_BOUND: 'processed' },
    });
    const res = await handleRequest(new Request('https://x/pay-status/pi_order'), env);
    expect(res.status).toBe(409);
    expect(writes).toEqual([]);
  });
});

describe('GET /pay binds the Kinesis payment to the order', () => {
  it('creates a payment and records its id and amount on the PaymentIntent', async () => {
    const writes = stubApis({ amount: 500, metadata: {}, kinesis: {} });
    await handleRequest(new Request('https://x/pay/pi_order'), env);
    const bind = writes.find((w) => w.url.endsWith('/payment_intents/pi_order'));
    expect(bind?.body).toContain('metadata[kinesis_payment_id]=KP_NEW');
    expect(bind?.body).toContain('metadata[kinesis_request]=500 usd');
  });

  it('clears an earlier payment’s settlement when the order amount changed', async () => {
    const writes = stubApis({
      amount: 50000,
      metadata: {
        kinesis_payment_id: 'KP_OLD',
        kinesis_request: '500 usd',
        kinesis_status: 'processed',
        kinesis_closed_at: '1',
      },
      kinesis: { KP_OLD: 'processed' },
    });
    await handleRequest(new Request('https://x/pay/pi_order'), env);
    const bind = writes.find((w) => w.url.endsWith('/payment_intents/pi_order'));
    expect(bind?.body).toContain('metadata[kinesis_payment_id]=KP_NEW');
    expect(bind?.body).toMatch(/metadata\[kinesis_status\]=(&|$)/);
    expect(bind?.body).toMatch(/metadata\[kinesis_closed_at\]=(&|$)/);
  });

  it('reuses the order’s open payment instead of creating another', async () => {
    const writes = stubApis({
      amount: 500,
      metadata: { kinesis_payment_id: 'KP_OPEN', kinesis_request: '500 usd' },
      kinesis: { KP_OPEN: 'created' },
    });
    const res = await handleRequest(new Request('https://x/pay/pi_order'), env);
    expect(await res.text()).toContain('KP_OPEN');
    expect(writes).toEqual([]);
  });
});
