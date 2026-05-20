import { KinesisPayError } from 'kinesis-exchange-sdk/pay';
import type { Env } from '../env.js';
import { makeKinesisPay } from '../lib/kinesis-pay.js';
import { json } from '../lib/response.js';

/**
 * GET /pay-status/:kinesis_payment_id
 *
 * Read-only status poll used by the /pay page. Returns the current
 * status plus a small subset of the Payment object useful to the UI.
 */
export async function handlePayStatus(
  _request: Request,
  kinesisPaymentId: string,
  env: Env,
): Promise<Response> {
  const kpay = makeKinesisPay(env);
  try {
    const payment = await kpay.getPaymentStatus(kinesisPaymentId);
    return json({
      status: payment.status,
      paymentId: payment.globalPaymentId ?? payment.paymentId ?? kinesisPaymentId,
      expiryAt: payment.expiryAt,
      paymentCurrency: payment.paymentCurrency,
      paymentCurrencyAmount: payment.paymentCurrencyAmount,
    });
  } catch (err) {
    if (err instanceof KinesisPayError) {
      return json(
        { error: err.message, statusCode: err.statusCode },
        { status: err.statusCode || 502 },
      );
    }
    const message = err instanceof Error ? err.message : String(err);
    console.error('[pay-status] error', { kinesisPaymentId, message });
    return json({ error: message }, { status: 502 });
  }
}
