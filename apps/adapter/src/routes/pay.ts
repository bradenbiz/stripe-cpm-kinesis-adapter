import type { Env } from '../env.js';
import { makeKinesisPay } from '../lib/kinesis-pay.js';
import { html } from '../lib/response.js';

/**
 * GET /pay/:payment_intent_id
 *
 * Creates a Kinesis Pay payment for the requested amount and renders
 * a page with a scannable QR code. The page polls /pay-status/:kpId
 * every 10s and updates the UI as the customer approves the payment in
 * their Kinesis app.
 *
 * For now the amount comes from query params (`?amount=5.00&currency=USD`).
 * In the real Stripe integration this route will look up the Stripe
 * PaymentIntent server-side to get amount and currency.
 *
 * `paymentIntentId` is used only as a correlation tag on the page — it
 * isn't sent to Kinesis yet.
 */
export async function handlePay(
  request: Request,
  paymentIntentId: string,
  env: Env,
): Promise<Response> {
  const url = new URL(request.url);
  const amountStr = url.searchParams.get('amount') ?? '5.00';
  const currency = (url.searchParams.get('currency') ?? 'USD').toUpperCase();

  const amount = Number(amountStr);
  if (!Number.isFinite(amount) || amount <= 0) {
    return html(renderErrorPage(`Invalid amount: ${amountStr}`), { status: 400 });
  }

  const kpay = makeKinesisPay(env);
  try {
    const payment = await kpay.createPayment({ amount, currency });
    const kinesisPaymentId = payment.globalPaymentId ?? payment.paymentId;
    if (!kinesisPaymentId) {
      throw new Error('Kinesis did not return a paymentId');
    }
    const redirectUrl = kpay.getRedirectUrl(kinesisPaymentId);
    console.log('[pay] created KP payment', {
      paymentIntentId,
      kinesisPaymentId,
      amount,
      currency,
    });
    return html(
      renderPayPage({ paymentIntentId, kinesisPaymentId, redirectUrl, amount, currency }),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[pay] createPayment failed', { paymentIntentId, message });
    return html(renderErrorPage(`Could not create Kinesis Pay payment: ${escapeHtml(message)}`), {
      status: 502,
    });
  }
}

interface RenderArgs {
  paymentIntentId: string;
  kinesisPaymentId: string;
  redirectUrl: string;
  amount: number;
  currency: string;
}

function renderPayPage(args: RenderArgs): string {
  const { paymentIntentId, kinesisPaymentId, redirectUrl, amount, currency } = args;
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Pay with Kinesis</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      :root {
        color-scheme: light;
        --bg: #fafaf9;
        --fg: #18181b;
        --muted: #71717a;
        --border: #e4e4e7;
        --card: #ffffff;
        --accent: #c2410c;
        --success: #15803d;
        --success-bg: #ecfccb;
        --warning: #a16207;
        --warning-bg: #fef3c7;
        --error: #b91c1c;
        --error-bg: #fee2e2;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
        background: var(--bg);
        color: var(--fg);
      }
      .container {
        max-width: 28rem;
        margin: 3rem auto;
        padding: 0 1.5rem;
      }
      .card {
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: 0.75rem;
        padding: 1.5rem;
      }
      h1 { margin: 0 0 1rem; font-size: 1.25rem; }
      .amount {
        font-size: 2rem;
        font-weight: 600;
        margin: 0.5rem 0 1rem;
      }
      .muted { color: var(--muted); font-size: 0.875rem; }
      code {
        background: #f4f4f5;
        padding: 0.125rem 0.375rem;
        border-radius: 0.25rem;
        font-size: 0.8125rem;
      }
      #qrcode {
        background: white;
        padding: 1rem;
        border-radius: 0.5rem;
        margin: 1rem auto;
        width: fit-content;
      }
      .status {
        padding: 0.75rem 1rem;
        border-radius: 0.5rem;
        font-size: 0.9375rem;
        margin-top: 1rem;
      }
      .status-created  { background: var(--warning-bg); color: var(--warning); }
      .status-accepted { background: var(--warning-bg); color: var(--warning); }
      .status-processed{ background: var(--success-bg); color: var(--success); }
      .status-rejected { background: var(--error-bg);   color: var(--error); }
      .status-expired  { background: var(--error-bg);   color: var(--error); }
      .footer { margin-top: 1.5rem; font-size: 0.8125rem; color: var(--muted); }
      .footer a { color: var(--accent); }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="card">
        <h1>Pay with Kinesis</h1>
        <div class="amount">${formatAmount(amount, currency)}</div>
        <p class="muted">Scan this QR code with your Kinesis app to approve the payment.</p>

        <div id="qrcode" aria-label="Kinesis Pay QR code"></div>

        <div id="status" class="status status-created">⏳ Waiting for you to scan and approve…</div>

        <p class="footer">
          Or <a href="${escapeHtml(redirectUrl)}" target="_blank" rel="noopener">open in Kinesis</a>
          if you're on the same device.
        </p>
        <p class="footer">
          Kinesis payment ID: <code>${escapeHtml(kinesisPaymentId)}</code><br />
          Reference: <code>${escapeHtml(paymentIntentId)}</code>
        </p>
      </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"></script>
    <script>
      (function () {
        var REDIRECT_URL = ${JSON.stringify(redirectUrl)};
        var KP_ID = ${JSON.stringify(kinesisPaymentId)};

        // Render the QR. The data is the kms.kinesis.money URL the SDK
        // gave us — Kinesis app opens it via deep link, web users land
        // on the KMS approve page.
        new QRCode(document.getElementById('qrcode'), {
          text: REDIRECT_URL,
          width: 200,
          height: 200,
          correctLevel: QRCode.CorrectLevel.L,
        });

        var statusEl = document.getElementById('status');
        var statusMessages = {
          created:   '⏳ Waiting for you to scan and approve…',
          accepted:  '✓ Approved in your Kinesis app — awaiting merchant capture…',
          processed: '✓ Payment complete. Funds captured.',
          rejected:  '✕ You declined the payment in your Kinesis app.',
          expired:   '✕ The payment expired before approval. Refresh to try again.',
        };
        var TERMINAL = { processed: 1, rejected: 1, expired: 1 };

        function setStatus(status) {
          statusEl.className = 'status status-' + status;
          statusEl.textContent = statusMessages[status] || ('Status: ' + status);
        }

        function poll() {
          fetch('/pay-status/' + encodeURIComponent(KP_ID))
            .then(function (r) { return r.json(); })
            .then(function (data) {
              if (data.status) setStatus(data.status);
              if (!TERMINAL[data.status]) setTimeout(poll, 10000);
            })
            .catch(function () { setTimeout(poll, 10000); });
        }
        // First poll after a short delay so the user sees the QR first.
        setTimeout(poll, 2000);
      })();
    </script>
  </body>
</html>`;
}

function renderErrorPage(message: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Kinesis Pay — error</title>
    <style>
      body { font-family: system-ui, sans-serif; max-width: 32rem; margin: 4rem auto; padding: 0 1rem; }
      .err { background: #fee2e2; border: 1px solid #b91c1c; color: #7f1d1d; padding: 1rem; border-radius: 0.5rem; }
    </style>
  </head>
  <body>
    <h1>Something went wrong</h1>
    <p class="err">${message}</p>
  </body>
</html>`;
}

function formatAmount(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  } catch {
    // Currency codes Kinesis supports (KAU, KAG) aren't valid ISO 4217 — fall back.
    return `${amount.toFixed(2)} ${currency}`;
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
