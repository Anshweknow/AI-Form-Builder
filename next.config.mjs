import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pin the workspace root to this project so Next doesn't get confused by
  // any stray lockfiles higher up the directory tree.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
