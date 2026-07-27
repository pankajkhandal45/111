import app from "./app";
import { logger } from "./lib/logger";
import { recalculateAllRatings } from "./lib/rating";

const rawPort = process.env.PORT || "8080";

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Recalculate ratings for existing finished games
  recalculateAllRatings().then(() => {
    logger.info("Ratings synced successfully");
  }).catch((e) => {
    logger.error({ e }, "Error syncing ratings");
  });
});
