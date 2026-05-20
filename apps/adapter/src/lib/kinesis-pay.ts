import {
  KINESIS_PAY_PROD_BASE_URL,
  KINESIS_PAY_PROD_KMS_BASE_URL,
  KINESIS_PAY_QA_BASE_URL,
  KINESIS_PAY_QA_KMS_BASE_URL,
  KinesisPayClient,
} from 'kinesis-exchange-sdk/pay';
import type { Env } from '../env.js';

export interface MakeKinesisPayOptions {
  /**
   * Target environment. Defaults to `'production'`.
   *
   */
  env?: 'production' | 'qa';
  /**
   * Allow `confirmPayment` to be called. Default `false`.
   *
   * `confirmPayment` is the only Kinesis Pay endpoint that captures
   * funds. With this flag off, calling it throws — even if a real
   * payment has been accepted by a customer. This is a belt-and-
   * suspenders guard on top of "don't write code that calls confirm
   * in dev." Set to `true` only when:
   *   - targeting QA credentials (no real funds at stake), OR
   *   - intentionally executing a real production capture as part of
   *     end-to-end testing with awareness of the financial impact.
   *
   * Auditable: any commit that flips this to `true` is grep-able.
   */
  allowCapture?: boolean;
}

/**
 * Construct a Kinesis Pay client for use inside the Cloudflare Worker.
 *
 * NOTE: not cached across requests — Workers should construct per request
 * to avoid leaking state between isolates that share a global.
 */
export function makeKinesisPay(env: Env, opts: MakeKinesisPayOptions = {}): KinesisPayClient {
  const targetEnv = opts.env ?? 'production';
  const allowCapture = opts.allowCapture === true;

  const client = new KinesisPayClient({
    publicKey: env.KINESIS_PUBLIC_KEY,
    privateKey: env.KINESIS_SECRET_KEY,
    merchantId: env.KINESIS_MERCHANT_ID,
    baseUrl: targetEnv === 'qa' ? KINESIS_PAY_QA_BASE_URL : KINESIS_PAY_PROD_BASE_URL,
    kmsBaseUrl: targetEnv === 'qa' ? KINESIS_PAY_QA_KMS_BASE_URL : KINESIS_PAY_PROD_KMS_BASE_URL,
  });

  if (allowCapture) return client;

  // Replace confirmPayment with a guard. Using defineProperty with
  // writable: false / configurable: false so the override can't be
  // un-done at runtime by accident or by clever code.
  // Match the async contract of the original confirmPayment so consumers
  // see the rejection on `await`, not a thrown sync exception.
  Object.defineProperty(client, 'confirmPayment', {
    value: () =>
      Promise.reject(
        new Error(
          'KinesisPayClient.confirmPayment is disabled — capture would move real funds. ' +
            'To enable: pass `{ allowCapture: true }` to makeKinesisPay(). ' +
            'See apps/adapter/src/lib/kinesis-pay.ts for guidance on when that is safe.',
        ),
      ),
    writable: false,
    configurable: false,
  });

  return client;
}
