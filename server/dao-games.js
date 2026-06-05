import { all, get, run } from "./db.js";
import { getAdjacency, getNetwork, shortestDistance } from "./dao-network.js";
import { validateRoute } from "./route-validation.js";

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

  const pair = candidates[Math.floor(Math.random() * candidates.length)]; // Randomly select a start/destination pair from the candidates
  const result = await run(
    `INSERT INTO games (user_id, start_station_id, destination_station_id, status)
     VALUES (?, ?, ?, 'planning')`,
    [userId, pair.startId, pair.destinationId],
  );

  return getGameById(result.id, userId);
}

export async function getGameById(gameId, userId) {
  return get(
    `SELECT g.id, g.status, g.initial_coins AS initialCoins, g.final_score AS finalScore,
            g.created_at AS createdAt,
            start.id AS startStationId, start.name AS startStationName,
            destination.id AS destinationStationId, destination.name AS destinationStationName
     FROM games g
     JOIN stations start ON start.id = g.start_station_id
     JOIN stations destination ON destination.id = g.destination_station_id
     WHERE g.id = ? AND g.user_id = ?`,
    [gameId, userId], // Prevent SQL injection by using parameterized queries
  );
}

export async function submitRoute(gameId, userId, route) {
  const game = await getGameById(gameId, userId);
  if (!game) return null;
  if (game.status !== "planning") {
    return { game, error: "Game is not in planning phase" };
  }

  const network = await getNetwork();
  const validation = validateRoute(game, route, network);

  if (!validation.valid) {
    await run(
      `UPDATE games
       SET status = 'failed', final_score = 0, route_json = ?, completed_at = CURRENT_TIMESTAMP
       WHERE id = ? AND user_id = ?`,
      [JSON.stringify(route), gameId, userId],
    );

    return {
      valid: false,
      reason: validation.reason,
      finalScore: 0,
      steps: [],
    };
  }

  const events = await all("SELECT id, description, effect FROM events ORDER BY id");
  let coins = game.initialCoins;
  const steps = [];

  for (let i = 0; i < route.length; i += 1) {
    const event = events[Math.floor(Math.random() * events.length)]; // Randomly select an event for each step
    coins += event.effect;

    await run(
      `INSERT INTO game_events
         (game_id, step_index, from_station_id, to_station_id, event_id, coins_after)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [gameId, i, route[i].from, route[i].to, event.id, coins],
    );

    steps.push({
      index: i,
      from: route[i].from,
      to: route[i].to,
      event: {
        description: event.description,
        effect: event.effect,
      },
      coinsAfter: coins,
    });
  }

  await run(
    `UPDATE games
     SET status = 'completed', final_score = ?, route_json = ?, completed_at = CURRENT_TIMESTAMP
     WHERE id = ? AND user_id = ?`,
    [Math.max(coins, 0), JSON.stringify(route), gameId, userId], // Ensure the final score is not negative
  );

  return {
    valid: true,
    finalScore: Math.max(coins, 0),
    steps,
  };
}

export async function getRanking() {
  return all(`
    SELECT u.username, u.name, MAX(MAX(g.final_score, 0)) AS bestScore
    FROM games g
    JOIN users u ON u.id = g.user_id
    WHERE g.status = 'completed' AND g.final_score IS NOT NULL
    GROUP BY u.id
    ORDER BY bestScore DESC, u.username ASC
    LIMIT 10
  `);
}
