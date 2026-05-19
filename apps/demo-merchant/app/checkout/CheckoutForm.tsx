'use client';

import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { type Stripe as StripeJs, loadStripe } from '@stripe/stripe-js';
import { type FormEvent, useMemo, useState } from 'react';

interface Props {
  clientSecret: string;
  publishableKey: string;
}

export default function CheckoutForm({ clientSecret, publishableKey }: Props) {
  // Memoise the promise so React's strict-mode double render doesn't cause
  // two Stripe instances to load.
  const stripePromise = useMemo<Promise<StripeJs | null>>(
    () => loadStripe(publishableKey),
    [publishableKey],
  );

  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <InnerForm />
    </Elements>
  );
}

function InnerForm() {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setSubmitting(true);
    setError(null);

    const origin = window.location.origin;
    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${origin}/success`,
      },
    });

    // If we reach this point, confirmation failed. (On success Stripe
    // redirects to `return_url` and this code does not run.)
    if (confirmError) {
      setError(confirmError.message ?? 'Payment failed.');
    }
    setSubmitting(false);
  }

  return (
    <form onSubmit={onSubmit}>
      <PaymentElement />
      <button
        type="submit"
        className="btn"
        disabled={!stripe || submitting}
        style={{ marginTop: '1rem', width: '100%' }}
      >
        {submitting ? 'Processing…' : 'Pay now'}
      </button>
      {error && <p className="error">{error}</p>}
    </form>
  );
}
