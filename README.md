# stripe-cpm-kinesis-adapter

Stripe Custom Payment Method adapter for Kinesis Pay. Includes a Cloudflare
Worker adapter service and a Next.js demo merchant site.

**Status: scaffold complete.** The demo merchant site runs
card-only checkout end-to-end against Stripe test mode; the adapter service
has stub routes for `/pay/:session_id`, `/webhook/stripe`, `/webhook/kinesis`,
and `/health`, with Stripe webhook signature verification wired up. CPM- and
Kinesis-specific code is deferred to later work.

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

### Demo merchant site

```sh
cp apps/demo-merchant/.env.example apps/demo-merchant/.env.local
# Edit .env.local — paste your Stripe test-mode keys from
# https://dashboard.stripe.com/test/apikeys
npm run dev:merchant
# → http://localhost:3000
```

Pick a product, hit "Buy", and pay with Stripe's test card
`4242 4242 4242 4242` (any future expiry / CVC / zip).

### Adapter worker

```sh
# Provide local secrets (gitignored):
cat > apps/adapter/.dev.vars <<'EOF'
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
KINESIS_WEBHOOK_SECRET=any_string_for_now
EOF

npm run dev:adapter
# → http://localhost:8787
# Try:  curl http://localhost:8787/health
#       curl http://localhost:8787/pay/cs_test_abc
```

## Checks

```sh
npm run lint        # biome
npm run typecheck   # tsc --noEmit in each workspace
npm test            # vitest in each workspace
npm run build       # next build + wrangler dry-run
```
