import { cpus } from 'os';

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    cpus: cpus().length,
    workerThreads: false,
  },
};

export default nextConfig;
