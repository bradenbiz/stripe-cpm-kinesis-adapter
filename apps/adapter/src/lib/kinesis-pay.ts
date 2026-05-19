import {
  KINESIS_PAY_QA_BASE_URL,
  KINESIS_PAY_QA_KMS_BASE_URL,
  KinesisPayClient,
} from 'kinesis-exchange-sdk/pay';
import type { Env } from '../env.js';

/**
 * Construct a Kinesis Pay client wired to the QA environment. Production
 * later, once we have real merchant credentials.
 *
 * NOTE: not cached across requests — Workers should construct per request
 * to avoid leaking state between isolates that share a global.
 */
export function makeKinesisPay(env: Env): KinesisPayClient {
  return new KinesisPayClient({
    publicKey: env.KINESIS_PUBLIC_KEY,
    privateKey: env.KINESIS_SECRET_KEY,
    merchantId: env.KINESIS_MERCHANT_ID,
    baseUrl: KINESIS_PAY_QA_BASE_URL,
    kmsBaseUrl: KINESIS_PAY_QA_KMS_BASE_URL,
  });
}
