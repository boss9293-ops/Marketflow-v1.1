/** @type {import('next').NextConfig} */
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
