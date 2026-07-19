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
            urlPattern: /^https:\/\/chesshub-kpl4\.onrender\.com\/api\//,
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
    sourcemap: false,
    cssCodeSplit: true,
    chunkSizeWarningLimit: 600,
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks(id) {
          // React core — single shared chunk so hooks work correctly
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/') || id.includes('node_modules/scheduler/')) {
            return 'react-vendor';
          }
          // Framer Motion ~100 KB
          if (id.includes('node_modules/framer-motion/')) {
            return 'framer-motion';
          }
          // Chess engine
          if (id.includes('node_modules/chess.js/')) {
            return 'chess';
          }
          // TanStack Query
          if (id.includes('node_modules/@tanstack/')) {
            return 'query';
          }
          // Radix UI primitives
          if (id.includes('node_modules/@radix-ui/')) {
            return 'ui-radix';
          }
          // Recharts (heavy — split out)
          if (id.includes('node_modules/recharts/') || id.includes('node_modules/d3') || id.includes('node_modules/victory')) {
            return 'charts';
          }
          // Lucide icons
          if (id.includes('node_modules/lucide-react/')) {
            return 'icons';
          }
          // PeerJS (WebRTC — only needed in game page)
          if (id.includes('node_modules/peerjs/') || id.includes('node_modules/webrtc')) {
            return 'webrtc';
          }
          // Zod + form libs
          if (id.includes('node_modules/zod/') || id.includes('node_modules/react-hook-form/') || id.includes('node_modules/@hookform/')) {
            return 'forms';
          }
          // Wouter router
          if (id.includes('node_modules/wouter/')) {
            return 'router';
          }
          // Utils
          if (id.includes('node_modules/date-fns/') || id.includes('node_modules/clsx/') || id.includes('node_modules/class-variance-authority/') || id.includes('node_modules/tailwind-merge/')) {
            return 'utils';
          }
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
      },
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
