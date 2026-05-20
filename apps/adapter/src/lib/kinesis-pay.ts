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
   * `confirmPayment` does not move funds (funds move on customer approval
   * in the Kinesis app — that's what transitions the status to `processed`).
   * What it DOES is attach a merchant-internal `orderId` to the Kinesis
   * payment record for reconciliation. The orderId persists on the Kinesis
   * side and shows up in subsequent `getPaymentStatus` responses.
   *
   * Why the guard, then? Two reasons:
   *
   *   1. external test runs would otherwise tag
   *      payment records with throwaway test orderIds, polluting
   *      the merchant's reconciliation state.
   *   2. confirmPayment is the "merchant-finalizes" call — semantically,
   *      after confirm runs the payment is considered fully reconciled
   *      from the merchant's side. Doing that in dev would prematurely
   *      mark a real payment as processed for a fake order.
   *
   * Set to `true` only when:
   *   - targeting QA credentials (no merchant state changes), OR
   *   - intentionally finalizing a merchant order, with a real
   *     merchant-side order identifier.
   *
   * Auditable: any commit that flips this to `true` is grep-able.
   */
  allowProcess?: boolean;
}

/**
 * Construct a Kinesis Pay client for use inside the Cloudflare Worker.
 *
 * NOTE: not cached across requests — Workers should construct per request
 * to avoid leaking state between isolates that share a global.
 */
export function makeKinesisPay(env: Env, opts: MakeKinesisPayOptions = {}): KinesisPayClient {
  const targetEnv = opts.env ?? 'production';
  const allowProcess = opts.allowProcess === true;

  const client = new KinesisPayClient({
    publicKey: env.KINESIS_PUBLIC_KEY,
    privateKey: env.KINESIS_SECRET_KEY,
    merchantId: env.KINESIS_MERCHANT_ID,
    baseUrl: targetEnv === 'qa' ? KINESIS_PAY_QA_BASE_URL : KINESIS_PAY_PROD_BASE_URL,
    kmsBaseUrl: targetEnv === 'qa' ? KINESIS_PAY_QA_KMS_BASE_URL : KINESIS_PAY_PROD_KMS_BASE_URL,
  });

  if (allowProcess) return client;

  // Replace confirmPayment with a guard. Using defineProperty with
  // writable: false / configurable: false so the override can't be
  // un-done at runtime by accident or by clever code.
  // Match the async contract of the original confirmPayment so consumers
  // see the rejection on `await`, not a thrown sync exception.
  Object.defineProperty(client, 'confirmPayment', {
    value: () =>
      Promise.reject(
        new Error(
          'KinesisPayClient.confirmPayment is disabled — would write a merchant-side ' +
            'orderId to a real Kinesis payment record. ' +
            'To enable: pass `{ allowProcess: true }` to makeKinesisPay(). ' +
            'See apps/adapter/src/lib/kinesis-pay.ts for guidance on when that is safe.',
        ),
      ),
    writable: false,
    configurable: false,
  });

  return client;
}
