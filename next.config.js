/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  transpilePackages: ['antd', '@vkontakte/vkui'],
  images: {
    domains: ['vk.com'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.userapi.com',
      },
    ],
  },
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000'],
    },
  },
};

module.exports = nextConfig;

