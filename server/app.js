import express from "express";
import morgan from "morgan";
import cors from "cors";
import session from "express-session";
import passport from "passport";

import apiRouter from "./api/routes.js";
import { configurePassport } from "./middleware/auth.js";
import { errorHandler } from "./middleware/error-handler.js";

const app = express();

configurePassport(passport);

app.use(morgan("dev")); // Log HTTP requests in development format
app.use(express.json()); // Parse incoming JSON request bodies and make them available under req.body
app.use(
  cors({ // Allow CORS requests from the React development server and include credentials (cookies) in cross-origin requests
    origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
    credentials: true,
  }),
);
app.use(
  session({
    secret: "last-race-development-secret",
    resave: false, // Don't save session if unmodified
    saveUninitialized: false // Don't create session until something is stored
  }),
);
app.use(passport.authenticate("session")); // Use Passport's session authentication middleware to restore authentication state from the session on each request

app.use("/api", apiRouter);
app.use(errorHandler);

export default app;
