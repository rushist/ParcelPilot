/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    serverComponentsExternalPackages: ['pg', '@qdrant/js-client-rest', 'pdf-parse', 'xlsx'],
    cpus: 1,
    workerThreads: false,
  },
};

export default nextConfig;
