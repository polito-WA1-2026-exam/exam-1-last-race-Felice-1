import { all, get, run } from "./db.js";
import { getAdjacency, getNetwork, shortestDistance } from "./dao-network.js";
import { validateRoute } from "../route-validation.js";

export async function createGame(userId) {
  const network = await getNetwork();
  const adjacency = getAdjacency(network.segments);
  const candidates = [];

  for (const start of network.stations) {
    for (const destination of network.stations) {
      if (start.id === destination.id) continue;
      const distance = shortestDistance(adjacency, start.id, destination.id);
      if (distance >= 3 && distance < Infinity) {
        candidates.push({ startId: start.id, destinationId: destination.id });
      }
    }
  }

  const pair = candidates[Math.floor(Math.random() * candidates.length)];
  const result = await run(
    `INSERT INTO games
       (user_id, start_station_id, destination_station_id, status, planning_deadline)
     VALUES (?, ?, ?, 'planning', datetime('now', '+90 seconds'))`,
    [userId, pair.startId, pair.destinationId],
  );

  return getGameById(result.id, userId);
}

export async function getGameById(gameId, userId) { // strftime formats date to ISO UTC string to ensure consistent timezone handling on client and to help JavaScript Date parsing without timezone issues
  return get(
    `SELECT g.id, g.status, g.initial_coins AS initialCoins, g.final_score AS finalScore,
            g.created_at AS createdAt, g.failure_reason AS failureReason,
            CASE
              WHEN g.planning_deadline IS NULL THEN NULL
              ELSE strftime('%Y-%m-%dT%H:%M:%SZ', g.planning_deadline)
            END AS planningDeadline,
            start.id AS startStationId, start.name AS startStationName,
            destination.id AS destinationStationId, destination.name AS destinationStationName
     FROM games g
     JOIN stations start ON start.id = g.start_station_id
     JOIN stations destination ON destination.id = g.destination_station_id
     WHERE g.id = ? AND g.user_id = ?`,
    [gameId, userId],
  );
}

async function failGame(gameId, userId, route, reason) {
  await run(
    `UPDATE games
     SET status = 'failed', final_score = 0, route_json = ?, failure_reason = ?,
         completed_at = CURRENT_TIMESTAMP
     WHERE id = ? AND user_id = ?`,
    [JSON.stringify(route), reason, gameId, userId],
  );

  return {
    valid: false,
    status: "failed",
    reason,
    finalScore: 0,
  };
}

export async function submitRoute(gameId, userId, route) {
  const game = await getGameById(gameId, userId);
  if (!game) return null;
  if (game.status !== "planning") {
    return { error: "Game is not in planning phase" };
  }

  const network = await getNetwork();
  const validation = validateRoute(game, route, network);

  if (!validation.valid) {
    return failGame(gameId, userId, route, validation.reason);
  }

  await run(
    `UPDATE games
     SET status = 'executing', route_json = ?, failure_reason = NULL
     WHERE id = ? AND user_id = ?`,
    [JSON.stringify(route), gameId, userId],
  );

  return {
    valid: true,
    status: "executing",
    totalSteps: route.length,
  };
}

export async function getExecutionState(gameId, userId) {
  const game = await getGameById(gameId, userId);
  if (!game) return null;
  if (!["executing", "completed"].includes(game.status)) {
    return { error: "Game is not in execution phase" };
  }

  const storedGame = await get("SELECT route_json FROM games WHERE id = ? AND user_id = ?", [
    gameId,
    userId,
  ]);
  const route = JSON.parse(storedGame.route_json);
  const revealedSteps = await all(
    `SELECT ge.step_index AS stepIndex,
            from_station.name AS fromStationName,
            to_station.name AS toStationName,
            e.description AS eventDescription, e.effect,
            ge.coins_after AS coinsAfter
     FROM game_events ge
     JOIN stations from_station ON from_station.id = ge.from_station_id
     JOIN stations to_station ON to_station.id = ge.to_station_id
     JOIN events e ON e.id = ge.event_id
     WHERE ge.game_id = ?
     ORDER BY ge.step_index`,
    [gameId],
  );

  return {
    game,
    totalSteps: route.length,
    revealedSteps,
    currentCoins: revealedSteps.at(-1)?.coinsAfter ?? game.initialCoins,
  };
}

export async function revealNextStep(gameId, userId) {
  const state = await getExecutionState(gameId, userId);
  if (!state) return null;
  if (state.error) return state;
  if (state.game.status !== "executing") {
    return { error: "Game execution is already complete" };
  }

  const routeRow = await get("SELECT route_json FROM games WHERE id = ? AND user_id = ?", [
    gameId,
    userId,
  ]);
  const route = JSON.parse(routeRow.route_json);
  const stepIndex = state.revealedSteps.length; // In case there are no revealed steps, we want to reveal the first step which is at index 0, so stepIndex should start at 0 and go up to route.length - 1
  const routeStep = route[stepIndex];
  const events = await all("SELECT id, description, effect FROM events ORDER BY id");
  const event = events[Math.floor(Math.random() * events.length)];
  const coinsAfter = state.currentCoins + event.effect;

  await run(
    `INSERT INTO game_events
       (game_id, step_index, from_station_id, to_station_id, event_id, coins_after)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [gameId, stepIndex, routeStep.from, routeStep.to, event.id, coinsAfter],
  );

  const completed = stepIndex === route.length - 1;
  if (completed) {
    await run(
      `UPDATE games
       SET status = 'completed', final_score = ?, completed_at = CURRENT_TIMESTAMP
       WHERE id = ? AND user_id = ?`,
      [Math.max(coinsAfter, 0), gameId, userId],
    );
  }

  const stations = await all("SELECT id, name FROM stations WHERE id IN (?, ?)", [
    routeStep.from,
    routeStep.to,
  ]);
  const stationName = (id) => stations.find((station) => station.id === id)?.name; 

  return {
    step: {
      stepIndex,
      fromStationName: stationName(routeStep.from),
      toStationName: stationName(routeStep.to),
      eventDescription: event.description,
      effect: event.effect,
      coinsAfter,
    },
    completed,
    finalScore: completed ? Math.max(coinsAfter, 0) : null,
  };
}

export async function getGameResult(gameId, userId) {
  const game = await getGameById(gameId, userId);
  if (!game) return null;
  if (!["completed", "failed"].includes(game.status)) {
    return { error: "Game result is not available yet" };
  }

  return game;
}

export async function getRanking() {
  return all(`
    SELECT u.username, u.name, MAX(g.final_score) AS bestScore
    FROM games g
    JOIN users u ON u.id = g.user_id
    WHERE g.status IN ('completed', 'failed') AND g.final_score IS NOT NULL
    GROUP BY u.id
    ORDER BY bestScore DESC, u.username ASC
    LIMIT 10
  `);
}
