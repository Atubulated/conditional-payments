import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
              // ✅ FIX 1: Added Google Fonts stylesheet domain
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "img-src 'self' data: https: blob:",
              // ✅ FIX 2: Added Google Fonts file server
              "font-src 'self' data: https://fonts.gstatic.com",
              // ✅ FIX 3: Made WalletConnect WebSocket domain explicit
              "connect-src 'self' https: wss: wss://relay.walletconnect.org wss://relay.walletconnect.com",
              "frame-src 'self' https:",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;