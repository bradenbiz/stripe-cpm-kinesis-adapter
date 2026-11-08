/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Next 16 writes an AGENTS.md into the app on every `next dev`; keep the tree clean.
  agentRules: false,
};

export default nextConfig;
