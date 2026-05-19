import Link from 'next/link';
import { PRODUCTS, formatPrice } from '../lib/products';

export default function Home() {
  return (
    <main className="container">
      <h1>Kinesis × Stripe — Demo Merchant</h1>
      <p className="muted">
        A test storefront for the Stripe CPM × Kinesis Pay adapter. Card checkout works today; the
        &quot;Pay with Kinesis&quot; option lands once CPM access is provisioned.
      </p>

      <div className="product-grid">
        {PRODUCTS.map((p) => (
          <div key={p.id} className="product-card">
            <h3>{p.name}</h3>
            <p>{p.description}</p>
            <div className="price">{formatPrice(p.priceCents)}</div>
            <Link className="btn" href={`/checkout?product=${p.id}`}>
              Buy
            </Link>
          </div>
        ))}
      </div>
    </main>
  );
}
