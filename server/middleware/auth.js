import LocalStrategy from "passport-local";

import { getUserByCredentials, getUserById } from "../dao/dao-users.js";

// Helper function to configure Passport.js with the local strategy and serialization/deserialization logic
export function configurePassport(passport) {
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
}

export function isLoggedIn(req, res, next) {
  if (req.isAuthenticated()) return next();
  return res.status(401).json({ error: "Not authenticated" });
}
