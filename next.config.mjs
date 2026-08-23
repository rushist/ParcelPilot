/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ['pg', '@qdrant/js-client-rest', 'pdf-parse', 'xlsx']
  }
};

export default nextConfig;
