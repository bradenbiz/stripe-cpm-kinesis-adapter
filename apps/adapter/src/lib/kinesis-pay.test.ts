import { describe, expect, it } from 'vitest';
import type { Env } from '../env.js';
import { makeKinesisPay } from './kinesis-pay.js';

const env: Env = {
  STRIPE_SECRET_KEY: 'sk_test_dummy',
  STRIPE_WEBHOOK_SECRET: 'whsec_dummy',
  KINESIS_WEBHOOK_SECRET: 'kinesis_dummy',
  KINESIS_PUBLIC_KEY: 'kp_pub_dummy',
  KINESIS_SECRET_KEY: 'kp_secret_dummy',
  KINESIS_MERCHANT_ID: 'mer_dummy',
};

describe('makeKinesisPay capture guard', () => {
  it('confirmPayment throws when allowCapture is omitted', async () => {
    const client = makeKinesisPay(env);
    await expect(() =>
      client.confirmPayment({ paymentId: 'p_x', orderId: 'o_x' }),
    ).rejects.toThrowError(/capture would move real funds/i);
  });

  it('confirmPayment throws when allowCapture is explicitly false', async () => {
    const client = makeKinesisPay(env, { allowCapture: false });
    await expect(() =>
      client.confirmPayment({ paymentId: 'p_x', orderId: 'o_x' }),
    ).rejects.toThrowError(/capture would move real funds/i);
  });

  it('the guard cannot be overwritten at runtime', () => {
    const client = makeKinesisPay(env);
    // Direct overwrite — should silently fail (non-writable) or throw in strict mode.
    expect(() => {
      (client as { confirmPayment: unknown }).confirmPayment = () => Promise.resolve();
    }).toThrow();
  });

  it('non-capture methods are NOT guarded — they still exist as real methods', () => {
    const client = makeKinesisPay(env);
    expect(typeof client.createPayment).toBe('function');
    expect(typeof client.getPaymentStatus).toBe('function');
    expect(typeof client.handshake).toBe('function');
    expect(typeof client.getRedirectUrl).toBe('function');
    // getRedirectUrl is pure — safe to call without network
    expect(client.getRedirectUrl('p_test')).toContain('paymentId=p_test');
  });

  it('opts.allowCapture: true returns an unwrapped client (confirmPayment is callable)', () => {
    const client = makeKinesisPay(env, { allowCapture: true });
    // We don't actually call it — that would hit the network. We just
    // verify the function reference is the SDK's, not our guard.
    expect(client.confirmPayment.toString()).not.toContain('capture would move real funds');
  });
});
