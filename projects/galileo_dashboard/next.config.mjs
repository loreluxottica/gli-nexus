/** @type {import('next').NextConfig} */

// Served under a subpath in the unified GLI Nexus app (Flask blueprint at
// /galileo). basePath makes `_next/*` assets and <Link> routes resolve there.
// Override with GALILEO_BASE_PATH="" to build for a root-served/standalone host.
const basePath = process.env.GALILEO_BASE_PATH ?? "/galileo";

// Where the client fetches its payloads. Follows basePath so a standalone build
// hits /api and the portal build /galileo/api; override for local dev, where
// `next dev` serves :3000 while Flask serves the API on another port.
const apiBase = process.env.NEXT_PUBLIC_GALILEO_API_BASE ?? `${basePath}/api`;

const nextConfig = {
  // Static export — the shell is static. The data is NOT baked in: it is fetched
  // at runtime from the Flask blueprint, which builds it from Databricks.
  output: "export",
  env: { NEXT_PUBLIC_GALILEO_API_BASE: apiBase },
  // Required for static export: no Image Optimization server.
  images: { unoptimized: true },
  // Emit /content/index.html etc. so the export works on plain file servers.
  trailingSlash: true,
  ...(basePath ? { basePath, assetPrefix: basePath } : {}),
};

export default nextConfig;
