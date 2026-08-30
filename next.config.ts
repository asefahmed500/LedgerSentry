import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  serverExternalPackages: ["tesseract.js", "pg", "@prisma/adapter-pg"],
}

export default nextConfig
