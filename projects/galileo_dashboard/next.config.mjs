/** @type {import('next').NextConfig} */

// Served under a subpath in the unified GLI Nexus app (Flask blueprint at
// /galileo). basePath makes `_next/*` assets and <Link> routes resolve there.
// Override with GALILEO_BASE_PATH="" to build for a root-served/standalone host.
const basePath = process.env.GALILEO_BASE_PATH ?? "/galileo";

const nextConfig = {
  // Static export — the data is fully static, no backend. The Flask blueprint
  // just serves the generated out/ directory.
  output: "export",
  // Required for static export: no Image Optimization server.
  images: { unoptimized: true },
  // Emit /content/index.html etc. so the export works on plain file servers.
  trailingSlash: true,
  ...(basePath ? { basePath, assetPrefix: basePath } : {}),
};

export default nextConfig;
