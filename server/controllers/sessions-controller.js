import passport from "passport";

// Helper function to handle login logic using Passport's local strategy. It returns a middleware function that can be used in the route handler for the login endpoint.
export function login(req, res, next) {
  passport.authenticate("local", (err, user, info) => {
    if (err) return next(err); // Propagate any error that occurred during authentication to the error handling middleware
    if (!user) {
      return res.status(401).json({ error: info?.message ?? "Invalid credentials" });
    }

    return req.login(user, (loginErr) => {
      if (loginErr) return next(loginErr);
      return res.status(201).json(req.user);
    });
  })(req, res, next); // Call the returned middleware function with the current request, response, and next objects
}

export function getCurrentSession(req, res) {
  if (!req.isAuthenticated()) return res.status(401).json({ error: "Not authenticated" });
  return res.json(req.user);
}

export function logout(req, res, next) {
  req.logout((err) => {
    if (err) return next(err);
    return res.status(204).end();
  });
}
