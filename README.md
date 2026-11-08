# stripe-cpm-kinesis-adapter

Stripe Custom Payment Method adapter for Kinesis Pay. Includes a Cloudflare
Worker adapter service and a Next.js demo merchant site.

**Status: working prototype.** The demo merchant site creates Stripe
PaymentIntents, renders Stripe's Payment Element, and can add a Kinesis Pay
Custom Payment Method (CPM). The adapter Worker creates Kinesis Pay payments,
renders the approval QR page, polls Kinesis status, and reports terminal
payment outcomes back to Stripe.

## Layout

```
apps/
  adapter/          Cloudflare Worker — the CPM adapter service
  demo-merchant/    Next.js 14 demo storefront
```

## Quickstart

```sh
npm install
```

The demo uses Stripe test-mode keys and Kinesis Pay merchant API credentials.
Keep real values in the gitignored local env files described below.

### Demo merchant site

```sh
cp apps/demo-merchant/.env.example apps/demo-merchant/.env.local
# Edit .env.local:
# - STRIPE_SECRET_KEY and NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY from Stripe test mode
# - KINESIS_CPMT_ID from Stripe Custom Payment Methods, or leave blank for card-only
# - NEXT_PUBLIC_ADAPTER_BASE_URL, usually http://localhost:8787
npm run dev:merchant
# -> http://localhost:3000
```

Pick a product, hit "Buy", and pay with Stripe's test card
`4242 4242 4242 4242` (any future expiry / CVC / zip). If
`KINESIS_CPMT_ID` is set, the Payment Element also shows the Kinesis Pay CPM.

### Adapter worker

```sh
cp apps/adapter/.dev.vars.example apps/adapter/.dev.vars
# Edit .dev.vars with Stripe test-mode keys and Kinesis Pay merchant API credentials.
# KINESIS_CPMT_ID must match the demo merchant's CPM type id.
# MERCHANT_RETURN_URL (default http://localhost:3000/success) is where
# customers land after paying; it is config, never a URL parameter.

npm run dev:adapter
# -> http://localhost:8787
# Try: curl http://localhost:8787/health
```

For the CPM path, run both dev servers. The merchant redirects to
`/pay/:payment_intent_id` on the adapter, the adapter displays the Kinesis Pay
QR approval page, and `/pay-status/:payment_intent_id` performs the terminal
closeout when Kinesis reports `processed`, `rejected`, or `expired`.

## Checks

```sh
npm run lint        # biome
npm run typecheck   # tsc --noEmit in each workspace
npm test            # vitest in each workspace
npm run build       # next build + wrangler dry-run
```
