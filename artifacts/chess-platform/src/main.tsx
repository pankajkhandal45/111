import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setBaseUrl } from "@workspace/api-client-react";

// Set the API base URL so all requests go to the backend regardless of how the frontend is served
setBaseUrl("http://localhost:8080");

createRoot(document.getElementById("root")!).render(<App />);
