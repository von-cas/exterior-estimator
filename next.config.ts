import type { NextConfig } from "next";

const config: NextConfig = {
  serverExternalPackages: ["unpdf"],
  experimental: { serverActions: { bodySizeLimit: "20mb" } },
};

export default config;
