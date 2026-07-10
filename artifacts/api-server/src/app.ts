import express, { type Express } from "express";
import cors from "cors";
import compression from "compression";
import pinoHttp from "pino-http";
import path from "path";
import { existsSync } from "fs";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
// Compress all responses except SSE streams — compression buffers chunked
// writes and would delay or drop real-time game events.
app.use(compression({
  filter: (req, res) => {
    if (res.getHeader('Content-Type') === 'text/event-stream') return false;
    return compression.filter(req, res);
  },
}));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API routes — always at /api so the frontend can use /api/... on the same origin.
// On Replit the Vite proxy rewrites /api → / before hitting this server,
// so we honour API_ROUTE_PREFIX for backward compatibility.
const routePrefix = process.env.API_ROUTE_PREFIX || "/";
app.use(routePrefix, router);

// ── Serve built frontend (single-server / Render.com deployment) ──────────────
// Build step copies chess-platform/dist → api-server/dist/public so it travels
// with the bundle and is always reachable at __dirname/public — no cwd guessing.
const frontendDist = path.resolve(__dirname, "public");
if (existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get("/{*splat}", (_req, res) => {
    res.sendFile(path.join(frontendDist, "index.html"));
  });
  logger.info({ frontendDist }, "Serving frontend static files");
} else {
  logger.warn({ frontendDist }, "Frontend dist not found — API-only mode");
}

export default app;
