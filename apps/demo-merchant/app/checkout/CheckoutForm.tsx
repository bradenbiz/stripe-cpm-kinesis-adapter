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
  cpmtId?: string;
}

export default function CheckoutForm(props: Props) {
  // Memoise the promise so React's strict-mode double render doesn't cause
  // two Stripe instances to load.
  const stripePromise = useMemo<Promise<StripeJs | null>>(
    () => loadStripe(props.publishableKey),
    [props.publishableKey],
  );

  // Custom payment methods are wired client-side via the Elements
  // `customPaymentMethods` option — NOT server-side via PaymentIntent's
  // `payment_method_types`.
  const elementsOptions: Parameters<typeof Elements>[0]['options'] = {
    clientSecret: props.clientSecret,
    ...(props.cpmtId
      ? {
          customPaymentMethods: [
            {
              id: props.cpmtId,
              options: { type: 'static' as const },
            },
          ],
        }
      : {}),
  };

  return (
    <Elements stripe={stripePromise} options={elementsOptions}>
      <InnerForm {...props} />
    </Elements>
  );
}

function InnerForm({ paymentIntentId, adapterBaseUrl, cpmtId }: Props) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Tracks the user's currently-selected payment method type. For CPMs
  // this is the cpmt_* id; for Stripe-processed methods it's 'card',
  // 'klarna', etc.
  const [selectedType, setSelectedType] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setSubmitting(true);
    setError(null);

    const origin = window.location.origin;
    const merchantSuccessUrl = `${origin}/success`;
    const isCustomPaymentMethod = cpmtId && selectedType === cpmtId;

    if (isCustomPaymentMethod) {
      // CPM path: Stripe does NOT process this. We must redirect the
      // customer to our adapter ourselves. The PaymentIntent stays in
      // `requires_payment_method` until the adapter reports the off-
      // Stripe payment via `paymentRecords.reportPayment`.
      const adapterReturnUrl =
        `${adapterBaseUrl}/pay/${encodeURIComponent(paymentIntentId)}` +
        `?merchant_return_url=${encodeURIComponent(merchantSuccessUrl)}`;
      window.location.href = adapterReturnUrl;
      return;
    }

    // Standard Stripe flow (Card, Klarna, Bank, etc.)
    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: merchantSuccessUrl },
    });

    if (confirmError) {
      setError(confirmError.message ?? 'Payment failed.');
    }
    setSubmitting(false);
  }

  return (
    <form onSubmit={onSubmit}>
      <PaymentElement
        onChange={(event) => {
          // event.value.type is the currently-selected method's type id.
          // For a CPM it's the cpmt_* string; for cards it's 'card'.
          setSelectedType(event.value.type ?? null);
        }}
      />
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
