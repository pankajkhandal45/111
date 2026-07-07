import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";

// PORT is only meaningful for the dev/preview server, not for production builds.
// Fall back to 5173 if PORT is missing or invalid so `vite build` never throws.
const rawPort = process.env.PORT || "5173";
const parsedPort = Number(rawPort);
const port = Number.isNaN(parsedPort) || parsedPort <= 0 ? 5173 : parsedPort;

const basePath = process.env.BASE_PATH || "/";

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['image.png'],
      workbox: {
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: /^\/api\//,
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /^https:\/\/chesshub-fzpb\.onrender\.com\/api\//,
            handler: 'NetworkOnly',
          },
        ],
      },
      manifest: {
        name: 'ChessHub',
        short_name: 'ChessHub',
        description: 'Play Chess Online',
        theme_color: '#ffffff',
        icons: [
          {
            src: 'image.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'image.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    }),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'router': ['wouter'],
          'query': ['@tanstack/react-query'],
          'chess': ['chess.js'],
          'ui-radix': [
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-dialog',
            '@radix-ui/react-tooltip',
            '@radix-ui/react-avatar',
            '@radix-ui/react-label',
            '@radix-ui/react-tabs',
            '@radix-ui/react-select',
          ],
        },
      },
    },
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
    },
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
        // Strip /api prefix before forwarding — matches Replit's path-based routing behavior.
        // Use word-boundary anchor so /apiary/... etc. are not accidentally rewritten.
        rewrite: (path) => path.replace(/^\/api(?=\/|$)/, ""),
      },
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
