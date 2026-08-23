/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  images: {},
  async rewrites() {
    // 本地开发：将 /api/v1 与 /media 反代到本地后端，免去 nginx。
    // Docker 生产环境由 nginx 在 80 端口先行拦截 /api/ 与 /media/，此 rewrite 不会触发。
    // Zeabur：通过 API_INTERNAL_URL 指向 API 服务，实现服务间代理。
    const upstream = process.env.API_INTERNAL_URL || "http://localhost:8000";
    return [
      { source: "/api/v1/:path*", destination: `${upstream}/api/v1/:path*` },
      { source: "/media/:path*", destination: `${upstream}/media/:path*` },
    ];
  },
};

export default nextConfig;
