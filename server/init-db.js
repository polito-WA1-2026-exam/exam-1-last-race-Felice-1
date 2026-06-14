import { get, run } from "./dao/db.js";
import { hashPassword } from "./password.js";

const users = [
  { username: "alice", name: "Alice Green", password: "password" },
  { username: "bob", name: "Bob Red", password: "password" },
  { username: "carol", name: "Carol Blue", password: "password" },
];

const stations = [
  { id: 1, name: "Central Station", x: 320, y: 210 },
  { id: 2, name: "North Market", x: 210, y: 120 },
  { id: 3, name: "Glass Bridge", x: 150, y: 220 },
  { id: 4, name: "Old Harbor", x: 130, y: 330 },
  { id: 5, name: "Lantern Square", x: 240, y: 420 },
  { id: 6, name: "East Library", x: 450, y: 150 },
  { id: 7, name: "Mosaic Avenue", x: 550, y: 250 },
  { id: 8, name: "River Gate", x: 610, y: 360 },
  { id: 9, name: "Sunset Park", x: 710, y: 450 },
  { id: 10, name: "Iron Garden", x: 390, y: 320 },
  { id: 11, name: "Echo Field", x: 360, y: 470 },
  { id: 12, name: "South Depot", x: 500, y: 520 },
  { id: 13, name: "Clocktower", x: 640, y: 150 },
];

const lines = [
  { id: 1, name: "Red Line", color: "#d43d3d", stations: [1, 2, 3, 4, 5] },
  { id: 2, name: "Blue Line", color: "#2f6ed8", stations: [1, 6, 7, 8, 9] },
  { id: 3, name: "Green Line", color: "#2e9f5b", stations: [2, 6, 10, 11, 12] },
  { id: 4, name: "Yellow Line", color: "#d6a52f", stations: [5, 10, 13, 12] },
];

const events = [
  { description: "Quiet journey", effect: 0 },
  { description: "Wrong platform", effect: -2 },
  { description: "Kind passenger", effect: 1 },
  { description: "Found a forgotten ticket", effect: 2 },
  { description: "Train delay", effect: -3 },
  { description: "Fast connection", effect: 3 },
  { description: "Crowded carriage", effect: -1 },
  { description: "Station bonus challenge", effect: 4 },
  { description: "Lost wallet scare", effect: -4 },
];

async function createSchema() {
  // Enable foreign key constraints: can't have games referencing non-existent users or stations, etc.
  await run("PRAGMA foreign_keys = ON");

  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      password_hash TEXT NOT NULL
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS stations (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      x INTEGER NOT NULL,
      y INTEGER NOT NULL
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS metro_lines (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS line_stations (
      line_id INTEGER NOT NULL REFERENCES metro_lines(id),
      station_id INTEGER NOT NULL REFERENCES stations(id),
      position INTEGER NOT NULL,
      PRIMARY KEY (line_id, station_id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      description TEXT NOT NULL,
      effect INTEGER NOT NULL CHECK (effect BETWEEN -4 AND 4)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS games (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      start_station_id INTEGER NOT NULL REFERENCES stations(id),
      destination_station_id INTEGER NOT NULL REFERENCES stations(id),
      status TEXT NOT NULL CHECK (status IN ('planning', 'executing', 'completed', 'failed')),
      initial_coins INTEGER NOT NULL DEFAULT 20,
      final_score INTEGER,
      route_json TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      planning_deadline TEXT,
      failure_reason TEXT,
      completed_at TEXT
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS game_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id INTEGER NOT NULL REFERENCES games(id),
      step_index INTEGER NOT NULL,
      from_station_id INTEGER NOT NULL REFERENCES stations(id),
      to_station_id INTEGER NOT NULL REFERENCES stations(id),
      event_id INTEGER NOT NULL REFERENCES events(id),
      coins_after INTEGER NOT NULL
    )
  `);

  await run(`
    CREATE UNIQUE INDEX IF NOT EXISTS game_events_game_step
    ON game_events(game_id, step_index)
  `); // Ensure we have a unique index on game_id and step_index to prevent duplicate entries for the same step in a game
}

async function seedDatabase() {
  // Check if users already exist to avoid duplicate seeding
  const userCount = await get("SELECT COUNT(*) AS count FROM users");
  if (userCount.count > 0) return;

  for (const user of users) {
    const { salt, hash } = await hashPassword(user.password);
    await run(
      "INSERT INTO users (username, name, password_salt, password_hash) VALUES (?, ?, ?, ?)",
      [user.username, user.name, salt, hash],
    );
  }

  for (const station of stations) {
    await run("INSERT INTO stations (id, name, x, y) VALUES (?, ?, ?, ?)", [
      station.id,
      station.name,
      station.x,
      station.y,
    ]);
  }

  for (const line of lines) {
    await run("INSERT INTO metro_lines (id, name, color) VALUES (?, ?, ?)", [
      line.id,
      line.name,
      line.color,
    ]);

    for (const [index, stationId] of line.stations.entries()) {
      await run("INSERT INTO line_stations (line_id, station_id, position) VALUES (?, ?, ?)", [
        line.id,
        stationId,
        index,
      ]);
    }
  }

  for (const event of events) {
    await run("INSERT INTO events (description, effect) VALUES (?, ?)", [
      event.description,
      event.effect,
    ]);
  }

  await run(`
    INSERT INTO games (user_id, start_station_id, destination_station_id, status, final_score, route_json, completed_at)
    VALUES
      (1, 1, 5, 'completed', 24, '[{"from":1,"to":2},{"from":2,"to":3},{"from":3,"to":4},{"from":4,"to":5}]', CURRENT_TIMESTAMP),
      (1, 6, 12, 'completed', 17, '[{"from":6,"to":10},{"from":10,"to":11},{"from":11,"to":12}]', CURRENT_TIMESTAMP),
      (2, 9, 1, 'completed', 21, '[{"from":9,"to":8},{"from":8,"to":7},{"from":7,"to":6},{"from":6,"to":1}]', CURRENT_TIMESTAMP)
  `);
}

export async function initDatabase() {
  await createSchema();
  await seedDatabase();
}
