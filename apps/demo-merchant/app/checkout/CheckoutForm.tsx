'use client';

import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { type Stripe as StripeJs, loadStripe } from '@stripe/stripe-js';
import { type FormEvent, useMemo, useState } from 'react';

interface Props {
  clientSecret: string;
  publishableKey: string;
  paymentIntentId: string;
  adapterBaseUrl: string;
  cpmEnabled: boolean;
}

export default function CheckoutForm(props: Props) {
  // Memoise the promise so React's strict-mode double render doesn't cause
  // two Stripe instances to load.
  const stripePromise = useMemo<Promise<StripeJs | null>>(
    () => loadStripe(props.publishableKey),
    [props.publishableKey],
  );

  return (
    <Elements stripe={stripePromise} options={{ clientSecret: props.clientSecret }}>
      <InnerForm {...props} />
    </Elements>
  );
}

function InnerForm({ paymentIntentId, adapterBaseUrl, cpmEnabled }: Props) {
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
    const merchantSuccessUrl = `${origin}/success`;

    // Strategy: ALWAYS return to the adapter when CPM is enabled.
    //   - For Card: adapter sees PI status `succeeded` → bounces to merchant /success
    //   - For CPM:  adapter sees PI requires_action → runs the QR flow, then
    //     redirects to merchant /success on `processed`
    // This sidesteps the "we don't know which method was selected at submit
    // time" problem — one return URL, adapter routes based on PI state.
    const returnUrl = cpmEnabled
      ? `${adapterBaseUrl}/pay/${encodeURIComponent(paymentIntentId)}` +
        `?merchant_return_url=${encodeURIComponent(merchantSuccessUrl)}`
      : merchantSuccessUrl;

    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: returnUrl },
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
