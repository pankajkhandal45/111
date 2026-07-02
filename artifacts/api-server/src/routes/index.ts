import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import gamesRouter from "./games";
import puzzlesRouter from "./puzzles";
import leaderboardRouter from "./leaderboard";
import friendsRouter from "./friends";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(usersRouter);
router.use(gamesRouter);
router.use(puzzlesRouter);
router.use(leaderboardRouter);
router.use(friendsRouter);
router.use(adminRouter);

export default router;
