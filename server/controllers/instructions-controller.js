export function getInstructions(req, res) {
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
}
