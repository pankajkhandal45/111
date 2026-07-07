import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
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
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API_ROUTE_PREFIX controls where routes are mounted.
//   Replit:     leave unset  → proxy strips /api prefix → mount at "/"
//   Render.com: set to /api  → Vercel proxy keeps /api prefix → mount at "/api"
//   Local dev:  Vite proxy rewrites /api → "" so same as Replit
const routePrefix = process.env.API_ROUTE_PREFIX || "/";
app.use(routePrefix, router);

export default app;
