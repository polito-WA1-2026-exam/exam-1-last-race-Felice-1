// Helper function to wrap async route handlers and catch any errors that occur during their execution
export function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}
