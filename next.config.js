/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: "/scanreason",
  assetPrefix: "/scanreason",
  images: { remotePatterns: [{ protocol: "https", hostname: "**" }] },
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
};
module.exports = nextConfig;
