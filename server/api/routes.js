import { Router } from "express";

import {
  createNewGame,
  getGame,
  getGameExecution,
  getPlanningData,
  getResult,
  revealNextExecutionStep,
  submitGameRoute,
} from "../controllers/games-controller.js";
import { getInstructions } from "../controllers/instructions-controller.js";
import { getFullNetwork } from "../controllers/network-controller.js";
import { getRankingList } from "../controllers/ranking-controller.js";
import { getCurrentSession, login, logout } from "../controllers/sessions-controller.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { isLoggedIn } from "../middleware/auth.js";

const router = Router();

router.get("/instructions", getInstructions); // No need to be logged in to view the instructions

router.post("/sessions", login);
router.get("/sessions/current", getCurrentSession); // No need to be logged in to check the current session, as this endpoint is used by the frontend to determine if the user is logged in or not. The controller will return null if the user is not logged in, and the user data if they are logged in.
router.delete("/sessions/current", isLoggedIn, logout);

router.get("/network", isLoggedIn, asyncHandler(getFullNetwork));

router.post("/games", isLoggedIn, asyncHandler(createNewGame));
router.get("/games/:id", isLoggedIn, asyncHandler(getGame));
router.get("/games/:id/planning-data", isLoggedIn, asyncHandler(getPlanningData));
router.post("/games/:id/route", isLoggedIn, asyncHandler(submitGameRoute));
router.get("/games/:id/execution", isLoggedIn, asyncHandler(getGameExecution));
router.post("/games/:id/execution/next", isLoggedIn, asyncHandler(revealNextExecutionStep));
router.get("/games/:id/result", isLoggedIn, asyncHandler(getResult));

router.get("/ranking", isLoggedIn, asyncHandler(getRankingList));

export default router;
