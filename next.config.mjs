/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    cpus: require('os').cpus().length,
    workerThreads: false,
  },
};

export default nextConfig;
