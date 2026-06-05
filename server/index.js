import express from "express";
import morgan from "morgan";
import cors from "cors";
import session from "express-session";
import passport from "passport";
import LocalStrategy from "passport-local";

import { initDatabase } from "./init-db.js";
import { getUserByCredentials, getUserById } from "./dao-users.js";
import { getNetwork, getPlanningNetwork } from "./dao-network.js";
import { createGame, getGameById, getRanking, submitRoute } from "./dao-games.js";

const app = express();
const port = 3001;

passport.use(
  new LocalStrategy(async (username, password, done) => {
    try {
      const user = await getUserByCredentials(username, password);
      if (!user) return done(null, false, { message: "Invalid credentials" });
      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }),
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await getUserById(id);
    done(null, user);
  } catch (err) {
    done(err);
  }
});

app.use(morgan("dev")); // Logging middleware for development
app.use(express.json()); // Middleware to parse JSON bodies from incoming requests
app.use(
  cors({ // Enable cookies in CORS requests from the frontend
    origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
    credentials: true,
  }),
);
app.use(
  session({ // Session middleware to handle user sessions with cookies
    secret: "last-race-development-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      sameSite: "lax",
    },
  }),
);
app.use(passport.authenticate("session"));

function isLoggedIn(req, res, next) { // Middleware to protect routes that require authentication
  if (req.isAuthenticated()) return next();
  return res.status(401).json({ error: "Not authenticated" });
}

function asyncHandler(handler) { // Utility to wrap async route handlers and catch errors
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

app.get("/api/instructions", (req, res) => {
  res.json({
    title: "Last Race",
    text: [
      "Plan a route across the underground network before the timer expires.",
      "Each game starts with 20 coins.",
      "During execution, random events can add or remove coins.",
      "Registered users can play and appear in the ranking.",
    ],
  });
});

app.post("/api/sessions", (req, res, next) => {
  passport.authenticate("local", (err, user, info) => {
    if (err) return next(err); 
    if (!user) {
      return res.status(401).json({ error: info?.message ?? "Invalid credentials" }); 
    }

    return req.login(user, (loginErr) => {
      if (loginErr) return next(loginErr);
      return res.status(201).json(req.user);
    });
  })(req, res, next);
});

app.get("/api/sessions/current", (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: "Not authenticated" });
  return res.json(req.user);
});

app.delete("/api/sessions/current", isLoggedIn, (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    return res.status(204).end();
  });
});

app.get(
  "/api/network",
  isLoggedIn,
  asyncHandler(async (req, res) => {
    const network = await getNetwork();
    res.json(network);
  }),
);

app.post(
  "/api/games",
  isLoggedIn,
  asyncHandler(async (req, res) => {
    const game = await createGame(req.user.id);
    res.status(201).json(game);
  }),
);

app.get(
  "/api/games/:id",
  isLoggedIn,
  asyncHandler(async (req, res) => {
    const gameId = Number(req.params.id);
    if (!Number.isInteger(gameId) || gameId <= 0) {
      return res.status(422).json({ error: "Invalid game id" });
    }

    const game = await getGameById(gameId, req.user.id);
    if (!game) return res.status(404).json({ error: "Game not found" });
    return res.json(game);
  }),
);

app.get(
  "/api/games/:id/planning-data",
  isLoggedIn,
  asyncHandler(async (req, res) => {
    const gameId = Number(req.params.id);
    if (!Number.isInteger(gameId) || gameId <= 0) {
      return res.status(422).json({ error: "Invalid game id" });
    }

    const game = await getGameById(gameId, req.user.id);
    if (!game) return res.status(404).json({ error: "Game not found" });
    if (game.status !== "planning") {
      return res.status(409).json({ error: "Game is not in planning phase" });
    }

    const network = await getPlanningNetwork();
    return res.json({ game, network });
  }),
);

app.post(
  "/api/games/:id/route",
  isLoggedIn,
  asyncHandler(async (req, res) => {
    const gameId = Number(req.params.id);
    if (!Number.isInteger(gameId) || gameId <= 0) {
      return res.status(422).json({ error: "Invalid game id" });
    }

    if (!Array.isArray(req.body.route)) {
      return res.status(422).json({ error: "Route must be an array" });
    }

    const result = await submitRoute(gameId, req.user.id, req.body.route); // req.user is populated by passport and contains the authenticated user's information
    if (!result) return res.status(404).json({ error: "Game not found" });
    if (result.error) return res.status(409).json({ error: result.error });

    return res.json(result);
  }),
);

app.get(
  "/api/ranking",
  isLoggedIn,
  asyncHandler(async (req, res) => {
    const ranking = await getRanking();
    res.json(ranking);
  }),
);

app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  return res.status(500).json({ error: "Internal server error" });
});

initDatabase()
  .then(() => {
    app.listen(port, () => {
      console.log(`Server listening at http://localhost:${port}`);
    });
  })
  .catch((err) => {
    console.error("Cannot initialize database", err);
    process.exit(1);
  });
