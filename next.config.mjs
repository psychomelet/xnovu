import os from 'os';

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    cpus: os.cpus().length,
    workerThreads: false,
  },
};

export default nextConfig;
