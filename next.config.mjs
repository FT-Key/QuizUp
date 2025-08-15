/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable experimental features for Socket.IO
  experimental: {
    serverComponentsExternalPackages: ['socket.io'],
  },
  // Webpack configuration for Socket.IO
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        net: false,
        tls: false,
        fs: false,
      }
    }
    return config
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
