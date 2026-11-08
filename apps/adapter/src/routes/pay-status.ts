import { KinesisPayError, type Payment } from 'kinesis-exchange-sdk/pay';
import type Stripe from 'stripe';
import type { Env } from '../env.js';
import { makeKinesisPay } from '../lib/kinesis-pay.js';
import { json } from '../lib/response.js';
import { makeStripe } from '../lib/stripe.js';
import { kinesisRequestFor } from './pay.js';

/**
 * GET /pay-status/:payment_intent_id
 *
 * Polled by the /pay page every 10s. Returns the status of the Kinesis Pay
 * payment bound to this PaymentIntent, and — when it reaches a terminal
 * state — performs the cross-system closeout:
 *
 *   processed:
 *     - kpay.confirmPayment(stripePiId): attach the Stripe PaymentIntent
 *       id to the Kinesis record (two-way reconciliation)
 *     - stripe.paymentIntents.update: stamp Kinesis details into the PI
 *       metadata so the merchant /success page can display them
 *     - stripe.paymentRecords.reportPayment: register the off-Stripe
 *       payment in Stripe's accounting (best-effort; logged on failure)
 *
 *   rejected / expired:
 *     - stripe.paymentIntents.cancel: clean up the abandoned PI
 *
 * Idempotent: subsequent polls see `kinesis_closed_at` already set in PI
 * metadata and skip the closeout calls.
 *
 * The Kinesis payment id is read from the PI's metadata, which only /pay
 * writes, never from the request. Taking both ids from the caller let
 * anyone pair any processed Kinesis payment (even a $0.50 one) with any
 * order and get it marked paid.
 */
export async function handlePayStatus(
  _request: Request,
  piId: string,
  env: Env,
): Promise<Response> {
  const stripe = makeStripe(env.STRIPE_SECRET_KEY);
  let intent: Stripe.PaymentIntent;
  try {
    intent = await stripe.paymentIntents.retrieve(piId);
  } catch {
    return json({ error: 'unknown PaymentIntent' }, { status: 404 });
  }
  const kinesisPaymentId = intent.metadata?.kinesis_payment_id;
  if (!kinesisPaymentId) {
    return json({ error: 'no Kinesis payment for this PaymentIntent' }, { status: 404 });
  }

  const kpay = makeKinesisPay(env);
  let payment: Payment;
  try {
    payment = await kpay.getPaymentStatus(kinesisPaymentId);
  } catch (err) {
    return errorResponse(err, kinesisPaymentId);
  }

  // The Kinesis payment was created for the amount recorded at /pay. If
  // the order's amount changed since, it no longer pays for this order.
  if (
    payment.status === 'processed' &&
    intent.metadata?.kinesis_request !== kinesisRequestFor(intent)
  ) {
    console.error('[pay-status] PaymentIntent amount changed after Kinesis payment was created', {
      kinesisPaymentId,
      piId,
    });
    return json({ error: 'order amount changed after payment was created' }, { status: 409 });
  }

  // Cross-system closeout for terminal states. Best-effort — errors are
  // logged but don't fail the poll response.
  if (payment.status === 'processed') {
    await closeoutProcessed(env, kinesisPaymentId, piId, payment).catch((err) => {
      console.error('[pay-status] closeout failed', { kinesisPaymentId, piId, err });
    });
  } else if (payment.status === 'rejected' || payment.status === 'expired') {
    await closeoutCanceled(env, piId, payment.status).catch((err) => {
      console.error('[pay-status] cancel failed', { piId, err });
    });
  }

  return json({
    status: payment.status,
    paymentId: payment.globalPaymentId ?? payment.paymentId ?? kinesisPaymentId,
    expiryAt: payment.expiryAt,
    paymentCurrency: payment.paymentCurrency,
    paymentCurrencyAmount: payment.paymentCurrencyAmount,
  });
}

/**
 * processed-state closeout. Idempotent via PI metadata sentinel.
 */
async function closeoutProcessed(
  env: Env,
  kinesisPaymentId: string,
  piId: string,
  payment: Payment,
): Promise<void> {
  const stripe = makeStripe(env.STRIPE_SECRET_KEY);
  const intent = await stripe.paymentIntents.retrieve(piId);

  if (intent.metadata?.kinesis_closed_at) {
    // Already closed out by a prior poll. Nothing to do.
    return;
  }

  // 1. Attach the Stripe PI id to the Kinesis record. allowProcess: true
  //    is the normal closeout use of the guard exit.
  const kpayWithCapture = makeKinesisPay(env, { allowProcess: true });
  try {
    await kpayWithCapture.confirmPayment({ paymentId: kinesisPaymentId, orderId: piId });
    console.log('[closeout] kpay.confirmPayment ok', { kinesisPaymentId, piId });
  } catch (err) {
    console.error('[closeout] kpay.confirmPayment failed', { kinesisPaymentId, piId, err });
    // Continue — reconciliation on the Kinesis side is best-effort.
  }

  // 2. Stamp Kinesis details into the PI metadata. This is the primary
  //    source of truth for the merchant /success page (which can't rely
  //    on intent.status reaching 'succeeded' for CPM flows).
  const metadata: Stripe.MetadataParam = {
    ...(intent.metadata ?? {}),
    kinesis_payment_id: kinesisPaymentId,
    kinesis_status: 'processed',
    kinesis_currency: String(payment.paymentCurrency ?? ''),
    kinesis_amount: String(payment.paymentCurrencyAmount ?? ''),
    kinesis_closed_at: String(Math.floor(Date.now() / 1000)),
  };
  try {
    await stripe.paymentIntents.update(piId, { metadata });
    console.log('[closeout] stripe metadata ok', { piId });
  } catch (err) {
    console.error('[closeout] stripe metadata update failed', { piId, err });
  }

  // 3. Report the off-Stripe payment to Stripe's PaymentRecords. This
  //    doesn't transition the PI status — PaymentRecords are standalone
  //    reporting entities — but it's the canonical way to register the
  //    payment in Stripe's accounting.
  try {
    await stripe.paymentRecords.reportPayment({
      amount_requested: {
        currency: (intent.currency ?? 'usd').toLowerCase(),
        value: intent.amount ?? 0,
      },
      initiated_at: intent.created,
      payment_method_details: {
        type: 'custom',
        custom: { type: env.KINESIS_CPMT_ID },
      },
      processor_details: {
        type: 'custom',
        custom: { payment_reference: kinesisPaymentId },
      },
      outcome: 'guaranteed',
      guaranteed: { guaranteed_at: Math.floor(Date.now() / 1000) },
      description: intent.description ?? 'Kinesis Pay payment',
      metadata: {
        stripe_payment_intent_id: piId,
        kinesis_payment_id: kinesisPaymentId,
      },
    });
    console.log('[closeout] stripe.paymentRecords.reportPayment ok', { piId });
  } catch (err) {
    console.error('[closeout] paymentRecords.reportPayment failed', { piId, err });
  }
}

/**
 * Terminal failure closeout. Marks the PI canceled so it doesn't sit
 * open. Idempotent in spirit — Stripe rejects cancel on an already-
 * canceled PI, we just log and move on.
 */
async function closeoutCanceled(env: Env, piId: string, reason: string): Promise<void> {
  const stripe = makeStripe(env.STRIPE_SECRET_KEY);
  try {
    const intent = await stripe.paymentIntents.retrieve(piId);
    if (intent.status === 'canceled') return;
    await stripe.paymentIntents.cancel(piId, {
      cancellation_reason: 'abandoned',
    });
    console.log('[closeout] PI canceled', { piId, reason });
  } catch (err) {
    console.error('[closeout] PI cancel failed', { piId, reason, err });
  }
}

function errorResponse(err: unknown, kinesisPaymentId: string): Response {
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
