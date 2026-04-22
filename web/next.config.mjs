/** @type {import('next').NextConfig} */

const BASE_PATH = process.env.GITHUB_ACTIONS === 'true' ? '/reviewscraper' : ''

const nextConfig = {
  output: 'export',
  basePath: BASE_PATH || undefined,
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  env: {
    NEXT_PUBLIC_BASE_PATH: BASE_PATH,
  },
}

export default nextConfig
