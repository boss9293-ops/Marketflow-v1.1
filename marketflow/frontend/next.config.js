/** @type {import('next').NextConfig} */
const RAILWAY_URL = 'https://marketflow-production-09df.up.railway.app'

const nextConfig = {
  webpack: (config, { dev }) => {
    if (dev) {
      // Disable webpack filesystem cache on Windows to prevent file-lock UNKNOWN errors
      config.cache = false
    }
    return config
  },
}
module.exports = nextConfig
