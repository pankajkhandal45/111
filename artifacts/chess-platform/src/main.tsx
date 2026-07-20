import { registerSW } from 'virtual:pwa-register';
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setBaseUrl } from "@workspace/api-client-react";

registerSW({ immediate: true });

const apiUrl = import.meta.env.VITE_API_URL || 
  (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? '' 
    : 'https://chesshub-fzpb.onrender.com');

if (apiUrl) {
  setBaseUrl(apiUrl);
}

// ── Backend warm-up (Render.com free tier cold start fix) ────────────────────
// Fire immediately so backend is warm before user interacts.
const HEALTH_URL = apiUrl ? `${apiUrl}/api/healthz` : '/api/healthz';

async function wakeBackend(retries = 3): Promise<void> {
  for (let i = 0; i < retries; i++) {
    try {
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), 8000);
      const res = await fetch(HEALTH_URL, { method: 'GET', cache: 'no-store', signal: ctrl.signal });
      clearTimeout(timeout);
      if (res.ok) return; // server is up!
    } catch {
      // server sleeping or slow — wait 5s then retry
      if (i < retries - 1) await new Promise(r => setTimeout(r, 5000));
    }
  }
}
wakeBackend();
// ─────────────────────────────────────────────────────────────────────────────

createRoot(document.getElementById("root")!).render(<App />);
