import { json } from '../lib/response.js';

export function handleHealth(): Response {
  return json({ status: 'ok', service: 'stripe-cpm-kinesis-adapter' });
}
