import { html } from '../lib/response.js';

/**
 * GET /pay/:session_id
 *
 * Stub. Renders a placeholder page that would, in the full implementation:
 *  1. Look up the Stripe checkout session by id.
 *  2. Create a corresponding Kinesis Pay payment via the Kinesis API.
 *  3. Render a QR code page the customer scans with the Kinesis app.
 *
 * Today it just confirms the route is wired and echoes the session id.
 */
export function handlePay(_request: Request, sessionId: string): Response {
  console.log('[pay] render QR page', { sessionId });
  const body = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Pay with Kinesis — stub</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { font-family: system-ui, sans-serif; max-width: 32rem; margin: 4rem auto; padding: 0 1rem; }
      code { background: #f4f4f5; padding: 0.125rem 0.375rem; border-radius: 0.25rem; }
      .stub { color: #a16207; }
    </style>
  </head>
  <body>
    <h1>Pay with Kinesis</h1>
    <p>Stripe checkout session: <code>${escapeHtml(sessionId)}</code></p>
    <p class="stub">QR rendering and Kinesis Pay integration are not available in this stub.</p>
  </body>
</html>`;
  return html(body, { status: 200 });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
