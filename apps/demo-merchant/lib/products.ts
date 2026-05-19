/**
 * A small fake catalog covering a cheap / medium / expensive price point.
 *
 * Prices are in USD cents — Stripe's native unit.
 */
export interface Product {
  id: string;
  name: string;
  description: string;
  priceCents: number;
}

export const PRODUCTS: readonly Product[] = [
  {
    id: 'sticker-pack',
    name: 'Kinesis Sticker Pack',
    description: 'Three vinyl stickers. Cheap test transaction.',
    priceCents: 500,
  },
  {
    id: 'gold-tee',
    name: 'Gold-Standard T-Shirt',
    description: 'Heavy cotton tee, "backed by gold" print across the chest.',
    priceCents: 5000,
  },
  {
    id: 'half-oz-bar',
    name: 'Half-Ounce Display Bar',
    description: 'Decorative half-oz bar replica. The big-ticket demo SKU.',
    priceCents: 50000,
  },
];

export function findProduct(id: string): Product | undefined {
  return PRODUCTS.find((p) => p.id === id);
}

export function formatPrice(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}
