import Link from 'next/link';
import { getStripe } from '../../lib/stripe';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: { payment_intent?: string; payment_intent_client_secret?: string };
}

export default async function SuccessPage({ searchParams }: PageProps) {
  const intentId = searchParams.payment_intent;

  let status = 'unknown';
  let amountCents: number | null = null;
  if (intentId) {
    const stripe = getStripe();
    const intent = await stripe.paymentIntents.retrieve(intentId);
    status = intent.status;
    amountCents = intent.amount;
  }

  return (
    <main className="container">
      <div className="success-banner">
        <h1 style={{ marginTop: 0 }}>Thanks — payment received.</h1>
        <p style={{ marginBottom: 0 }}>
          Stripe PaymentIntent: <code>{intentId ?? 'n/a'}</code>
          <br />
          Status: <code>{status}</code>
          {amountCents !== null && (
            <>
              <br />
              Amount: <code>${(amountCents / 100).toFixed(2)}</code>
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
