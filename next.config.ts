import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  images: { unoptimized: true },
  serverExternalPackages: ["unpdf", "wrangler", "@cloudflare/puppeteer"],
};

export default nextConfig;

if (process.env.NODE_ENV === "development") {
  void initOpenNextCloudflareForDev();
}
