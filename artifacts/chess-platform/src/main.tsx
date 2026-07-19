import { registerSW } from 'virtual:pwa-register';
import { createRoot } from "react-dom/client";

registerSW({ immediate: true });
import App from "./App";
import "./index.css";
import { setBaseUrl } from "@workspace/api-client-react";

// Only set a base URL when explicitly configured (e.g. for native mobile builds).
// In web builds (Replit preview, Vercel) API calls use relative paths so the
// platform proxy (Replit path-router or vercel.json rewrite) handles routing.
const apiUrl = import.meta.env.VITE_API_URL;
if (apiUrl) {
  setBaseUrl(apiUrl);
}

// ── Backend warm-up ping ──────────────────────────────────────────────────────
// Render.com free tier sleeps after ~15 min of inactivity.
// This silent ping fires immediately so the server is awake by the time
// the user makes a real request (login, game load, etc.)
const backendBase = apiUrl || '';
fetch(`${backendBase}/api/health`, {
  method: 'GET',
  cache: 'no-store',
  signal: AbortSignal.timeout(8000),
}).catch(() => { /* intentionally silent — server may be starting up */ });
// ─────────────────────────────────────────────────────────────────────────────

createRoot(document.getElementById("root")!).render(<App />);
