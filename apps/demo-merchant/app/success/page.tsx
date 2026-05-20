import Link from 'next/link';
import { getStripe } from '../../lib/stripe';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: { payment_intent?: string; payment_intent_client_secret?: string };
}

export default async function SuccessPage({ searchParams }: PageProps) {
  const intentId = searchParams.payment_intent;

  let intent: Awaited<
    ReturnType<ReturnType<typeof getStripe>['paymentIntents']['retrieve']>
  > | null = null;
  if (intentId) {
    intent = await getStripe().paymentIntents.retrieve(intentId);
  }

  // For Card payments, intent.status === 'succeeded'.
  // For Kinesis Pay (CPM) payments, intent.status stays at 'requires_payment_method'
  // (Stripe doesn't process CPMs). The adapter writes the actual outcome into
  // metadata: kinesis_status=processed + kinesis_payment_id + kinesis_amount +
  // kinesis_currency.
  const kinesisStatus = intent?.metadata?.kinesis_status;
  const kinesisPaymentId = intent?.metadata?.kinesis_payment_id;
  const kinesisAmount = intent?.metadata?.kinesis_amount;
  const kinesisCurrency = intent?.metadata?.kinesis_currency;

  const paidViaKinesis = kinesisStatus === 'processed';
  const paidViaCard = intent?.status === 'succeeded';
  const paid = paidViaKinesis || paidViaCard;

  return (
    <main className="container">
      <div
        className="success-banner"
        style={paid ? undefined : { background: '#fef3c7', borderColor: '#a16207' }}
      >
        <h1 style={{ marginTop: 0 }}>
          {paid ? 'Thanks — payment received.' : 'Payment status pending.'}
        </h1>
        <p style={{ marginBottom: 0 }}>
          Stripe PaymentIntent: <code>{intentId ?? 'n/a'}</code>
          <br />
          {paidViaKinesis ? (
            <>
              Paid via: <code>Kinesis Pay</code>
              <br />
              Kinesis payment id: <code>{kinesisPaymentId}</code>
              <br />
              Amount:{' '}
              <code>
                {kinesisAmount} {kinesisCurrency}
              </code>
              {intent?.amount !== undefined && (
                <>
                  {' '}
                  (= <code>${(intent.amount / 100).toFixed(2)}</code> USD)
                </>
              )}
            </>
          ) : paidViaCard ? (
            <>
              Paid via: <code>Card</code>
              <br />
              Amount: <code>${((intent?.amount ?? 0) / 100).toFixed(2)}</code>
            </>
          ) : (
            <>
              Status: <code>{intent?.status ?? 'unknown'}</code>
            </>
          )}
        </p>
      </div>
      <p style={{ marginTop: '1.5rem' }}>
        <Link href="/">← back to catalog</Link>
      </p>
    </main>
  );
}
