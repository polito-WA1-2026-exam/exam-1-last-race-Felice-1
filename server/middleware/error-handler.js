// Helper function to handle errors that occur during request processing
export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err); // If the headers have already been sent, delegate to the default Express error handler
  if (err instanceof SyntaxError && "body" in err) {
    return res.status(400).json({ error: "Invalid JSON body" }); // Handle JSON parsing errors specifically
  }

  console.error(err);
  return res.status(500).json({ error: "Internal server error" });
}
