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
  MERCHANT_RETURN_URL: 'https://shop.example/success',
};

/** Fake Stripe + Kinesis Pay: one PaymentIntent with the given status. */
function stubApis(piStatus: string) {
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
    if (url.includes('api.stripe.com/v1/payment_intents/')) {
      return json({
        id: 'pi_1',
        object: 'payment_intent',
        amount: 500,
        currency: 'usd',
        status: piStatus,
      });
    }
    if (url.endsWith('/api/merchants/payment')) {
      return json({ globalPaymentId: 'KP_NEW', status: 'created' });
    }
    return new Response('unexpected', { status: 500 });
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('GET /pay return URL', () => {
  const evil = encodeURIComponent('javascript:alert(document.domain)//');

  it('card path redirects to MERCHANT_RETURN_URL, ignoring merchant_return_url', async () => {
    stubApis('succeeded');
    const res = await handleRequest(
      new Request(
        `https://x/pay/pi_1?merchant_return_url=${encodeURIComponent('https://evil.example/')}`,
      ),
      env,
    );
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('https://shop.example/success?payment_intent=pi_1');
  });

  it('QR page redirects to MERCHANT_RETURN_URL, ignoring merchant_return_url', async () => {
    stubApis('requires_payment_method');
    const res = await handleRequest(
      new Request(`https://x/pay/pi_1?merchant_return_url=${evil}`),
      env,
    );
    const body = await res.text();
    expect(body).toContain(
      'var SUCCESS_REDIRECT = "https://shop.example/success?payment_intent=pi_1";',
    );
    expect(body).not.toContain('javascript:');
  });
});

describe('GET /pay QR page', () => {
  it('draws the QR as inline SVG and loads no third-party script', async () => {
    stubApis('requires_payment_method');
    const res = await handleRequest(new Request('https://x/pay/pi_1'), env);
    const body = await res.text();
    expect(res.status).toBe(200);
    expect(body).toMatch(/<div id="qrcode"[^>]*><svg [^>]*>/);
    expect(body).not.toMatch(/<script[^>]+src=/);
  });
});
