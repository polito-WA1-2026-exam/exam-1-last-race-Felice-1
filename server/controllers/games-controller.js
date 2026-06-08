import { getPlanningNetwork } from "../dao/dao-network.js";
import {
  createGame,
  getExecutionState,
  getGameById,
  getGameResult,
  revealNextStep,
  submitRoute,
} from "../dao/dao-games.js";

// Helper function to parse and validate the game id from the request parameters
function parseGameId(req, res) {
  const gameId = Number(req.params.id);
  if (!Number.isInteger(gameId) || gameId <= 0) {
    res.status(422).json({ error: "Invalid game id" });
    return null;
  }

  return gameId;
}

export async function createNewGame(req, res) {
  const game = await createGame(req.user.id);
  res.status(201).json(game);
}

export async function getGame(req, res) {
  const gameId = parseGameId(req, res);
  if (gameId === null) return;

  const game = await getGameById(gameId, req.user.id);
  if (!game) return res.status(404).json({ error: "Game not found" });
  return res.json(game);
}

export async function getPlanningData(req, res) {
  const gameId = parseGameId(req, res);
  if (gameId === null) return;

  const game = await getGameById(gameId, req.user.id);
  if (!game) return res.status(404).json({ error: "Game not found" });
  if (game.status !== "planning") {
    return res.status(409).json({ error: "Game is not in planning phase" });
  }

  const network = await getPlanningNetwork();
  return res.json({ game, network });
}

export async function submitGameRoute(req, res) {
  const gameId = parseGameId(req, res);
  if (gameId === null) return;

  if (!req.body || !Array.isArray(req.body.route)) {
    return res.status(422).json({ error: "Route must be an array" });
  }

  const result = await submitRoute(gameId, req.user.id, req.body.route);
  if (!result) return res.status(404).json({ error: "Game not found" });
  if (result.error) return res.status(409).json({ error: result.error });

  return res.json(result);
}

export async function getGameExecution(req, res) {
  const gameId = parseGameId(req, res);
  if (gameId === null) return;

  const state = await getExecutionState(gameId, req.user.id);
  if (!state) return res.status(404).json({ error: "Game not found" });
  if (state.error) return res.status(409).json({ error: state.error });
  return res.json(state);
}

export async function revealNextExecutionStep(req, res) {
  const gameId = parseGameId(req, res);
  if (gameId === null) return;

  const result = await revealNextStep(gameId, req.user.id);
  if (!result) return res.status(404).json({ error: "Game not found" });
  if (result.error) return res.status(409).json({ error: result.error });
  return res.json(result);
}

export async function getResult(req, res) {
  const gameId = parseGameId(req, res);
  if (gameId === null) return;

  const result = await getGameResult(gameId, req.user.id);
  if (!result) return res.status(404).json({ error: "Game not found" });
  if (result.error) return res.status(409).json({ error: result.error });
  return res.json(result);
}
