import express from "express";
import morgan from "morgan";
import cors from "cors";
import session from "express-session";
import passport from "passport";
import LocalStrategy from "passport-local";

import { initDatabase } from "./init-db.js";
import { getUserByCredentials, getUserById } from "./dao-users.js";
import { getNetwork, getPlanningNetwork } from "./dao-network.js";
import {
  createGame,
  getExecutionState,
  getGameById,
  getGameResult,
  getRanking,
  revealNextStep,
  submitRoute,
} from "./dao-games.js";

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

// Get the game instructions 
app.get("/api/instructions", (req, res) => {
  res.json({
    title: "Last Race",
    text: [
      "Study the complete underground network during the setup phase.",
      "During planning, build a route from the assigned start to the destination within 90 seconds.",
      "Each segment may be used only once, while the same station may be visited more than once.",
      "Line changes are allowed only at interchange stations.",
      "Each game starts with 20 coins. Random events add or remove coins during execution.",
      "Invalid or incomplete routes score zero. Registered users appear in the ranking with their best score.",
    ],
  });
});

// Authentication routes
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

// Logout route that destroys the user session and clears the cookie
app.delete("/api/sessions/current", isLoggedIn, (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    return res.status(204).end();
  });
});

// Get the network data for the planning phase, protected by authentication middleware
app.get(
  "/api/network",
  isLoggedIn,
  asyncHandler(async (req, res) => {
    const network = await getNetwork();
    res.json(network);
  }),
);

// Create a new game for the authenticated user, returning the game details in the response
app.post(
  "/api/games",
  isLoggedIn,
  asyncHandler(async (req, res) => {
    const game = await createGame(req.user.id);
    res.status(201).json(game);
  }),
);

// Get the details of a specific game by its ID, ensuring the game belongs to the authenticated user and is in the planning phase
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

// Get the planning data for a specific game, including the game details and the network, ensuring the game belongs to the authenticated user and is in the planning phase
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

// Submit the planned route for a specific game, validating the route and updating the game status accordingly, ensuring the game belongs to the authenticated user and is in the planning phase
app.post(
  "/api/games/:id/route",
  isLoggedIn,
  asyncHandler(async (req, res) => {
    const gameId = Number(req.params.id);
    if (!Number.isInteger(gameId) || gameId <= 0) {
      return res.status(422).json({ error: "Invalid game id" });
    }

    if (!req.body || !Array.isArray(req.body.route)) {
      return res.status(422).json({ error: "Route must be an array" });
    }

    const result = await submitRoute(gameId, req.user.id, req.body.route); // req.user is populated by passport and contains the authenticated user's information
    if (!result) return res.status(404).json({ error: "Game not found" });
    if (result.error) return res.status(409).json({ error: result.error });

    return res.json(result);
  }),
);

// Get the current execution state of a specific game, including revealed steps and current score, ensuring the game belongs to the authenticated user and is in the execution phase
app.get(
  "/api/games/:id/execution",
  isLoggedIn,
  asyncHandler(async (req, res) => {
    const gameId = Number(req.params.id);
    if (!Number.isInteger(gameId) || gameId <= 0) {
      return res.status(422).json({ error: "Invalid game id" });
    }

    const state = await getExecutionState(gameId, req.user.id);
    if (!state) return res.status(404).json({ error: "Game not found" });
    if (state.error) return res.status(409).json({ error: state.error });
    return res.json(state);
  }),
);

// Reveal the next step in the execution of a specific game, updating the game state accordingly, ensuring the game belongs to the authenticated user and is in the execution phase
app.post(
  "/api/games/:id/execution/next",
  isLoggedIn,
  asyncHandler(async (req, res) => {
    const gameId = Number(req.params.id);
    if (!Number.isInteger(gameId) || gameId <= 0) {
      return res.status(422).json({ error: "Invalid game id" });
    }

    const result = await revealNextStep(gameId, req.user.id);
    if (!result) return res.status(404).json({ error: "Game not found" });
    if (result.error) return res.status(409).json({ error: result.error });
    return res.json(result);
  }),
);

// Get the final result of a specific game after execution is completed, including the final score and any failure reason, ensuring the game belongs to the authenticated user and is in the completed phase
app.get(
  "/api/games/:id/result",
  isLoggedIn,
  asyncHandler(async (req, res) => {
    const gameId = Number(req.params.id);
    if (!Number.isInteger(gameId) || gameId <= 0) {
      return res.status(422).json({ error: "Invalid game id" });
    }

    const result = await getGameResult(gameId, req.user.id);
    if (!result) return res.status(404).json({ error: "Game not found" });
    if (result.error) return res.status(409).json({ error: result.error });
    return res.json(result);
  }),
);

// Get the ranking of all users based on their best scores, ensuring only authenticated users can access the ranking
app.get(
  "/api/ranking",
  isLoggedIn,
  asyncHandler(async (req, res) => {
    const ranking = await getRanking();
    res.json(ranking);
  }),
);

// Global error handling middleware to catch any unhandled errors and return a consistent error response
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (err instanceof SyntaxError && "body" in err) {
    return res.status(400).json({ error: "Invalid JSON body" });
  }
  console.error(err);
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
