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

createRoot(document.getElementById("root")!).render(<App />);
