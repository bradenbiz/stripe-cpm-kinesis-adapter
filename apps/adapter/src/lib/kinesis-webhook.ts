/**
 * Verify a Kinesis Pay webhook signature.
 *
 * Per spec: HMAC-SHA256 of the raw request body with a secret shared at
 * integration time. Header carries the hex-encoded digest.
 *
 * Stub implementation: the exact header name and digest format will be
 * confirmed when Kinesis Pay integration begins. For now we
 * implement the canonical HMAC-SHA256 hex form so the route can be wired
 * end-to-end without further plumbing.
 */
export async function verifyKinesisWebhook(
  rawBody: string,
  signatureHex: string,
  secret: string,
): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const macBuf = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody));
  const expected = bufferToHex(macBuf);
  return timingSafeEqual(expected, signatureHex.toLowerCase());
}

function bufferToHex(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    // biome-ignore lint/style/noNonNullAssertion: bounded by loop
    out += bytes[i]!.toString(16).padStart(2, '0');
  }
  return out;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
