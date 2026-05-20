import { notFound } from 'next/navigation';
import { findProduct, formatPrice } from '../../lib/products';
import { getStripe } from '../../lib/stripe';
import CheckoutForm from './CheckoutForm';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: { product?: string };
}

export default async function CheckoutPage({ searchParams }: PageProps) {
  const productId = searchParams.product;
  if (!productId) notFound();

  const product = findProduct(productId);
  if (!product) notFound();

  // Card is always available. The CPM type id is optional — if set, the
  // Payment Element renders "Pay with Gold" as a second option.
  const cpmtId = process.env.KINESIS_CPMT_ID?.trim();
  const paymentMethodTypes: string[] = ['card'];
  if (cpmtId) paymentMethodTypes.push(cpmtId);

  const stripe = getStripe();
  const intent = await stripe.paymentIntents.create({
    amount: product.priceCents,
    currency: 'usd',
    payment_method_types: paymentMethodTypes,
    description: product.name,
    metadata: { product_id: product.id },
  });

  if (!intent.client_secret) {
    throw new Error('Stripe did not return a client_secret for the PaymentIntent.');
  }

  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (!publishableKey) {
    throw new Error('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set.');
  }

  const adapterBaseUrl =
    process.env.NEXT_PUBLIC_ADAPTER_BASE_URL?.trim() || 'http://localhost:8787';

  return (
    <main className="container">
      <h1>Checkout</h1>
      <div className="checkout-summary">
        <strong>{product.name}</strong>
        <p className="muted" style={{ margin: '0.25rem 0 0' }}>
          {product.description}
        </p>
        <div className="price" style={{ marginTop: '0.75rem' }}>
          {formatPrice(product.priceCents)}
        </div>
      </div>

      <CheckoutForm
        clientSecret={intent.client_secret}
        publishableKey={publishableKey}
        paymentIntentId={intent.id}
        adapterBaseUrl={adapterBaseUrl}
        cpmEnabled={Boolean(cpmtId)}
      />

      <p className="muted" style={{ marginTop: '2rem' }}>
        Test card: <code>4242 4242 4242 4242</code>, any future expiry, any CVC, any zip.
      </p>
    </main>
  );
}
