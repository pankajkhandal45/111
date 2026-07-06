import { registerSW } from 'virtual:pwa-register';
import { createRoot } from "react-dom/client";

registerSW({ immediate: true });
import App from "./App";
import "./index.css";
import { setBaseUrl } from "@workspace/api-client-react";

// Set the API base URL from the environment, falling back to localhost for local development
const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8080";
setBaseUrl(apiUrl);

createRoot(document.getElementById("root")!).render(<App />);
