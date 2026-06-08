function segmentKey(from, to) {
  return [from, to].sort((a, b) => a - b).join("-"); // Normalize the segment key to be independent of direction and return the key as a string
}
// This function is used to determine which stations are interchanges and which lines pass through each station
function getStationLineCounts(network) { 
  const lineIdsByStation = new Map();

  for (const line of network.lines) {
    for (const station of line.stations) {
      const lineIds = lineIdsByStation.get(station.id) ?? new Set();
      lineIds.add(line.id);
      lineIdsByStation.set(station.id, lineIds);
    }
  }

  return lineIdsByStation;
}

// This function checks if it's possible to assign lines to the route segments while respecting the rule that line changes can only occur at interchange stations
function canAssignLines(route, segmentsByKey, lineIdsByStation) {
  let possiblePreviousLines = null;

  for (let i = 0; i < route.length; i += 1) {
    const step = route[i];
    const segment = segmentsByKey.get(segmentKey(step.from, step.to));
    const possibleCurrentLines = new Set(segment.lineIds);

    if (possiblePreviousLines === null) {
      possiblePreviousLines = possibleCurrentLines;
      continue;
    }

    const interchangeStationId = step.from; // Because step.from is the same station as the previous step.to, we can check for line changes at this station
    const stationLines = lineIdsByStation.get(interchangeStationId) ?? new Set();
    const isInterchange = stationLines.size > 1;
    const nextPossibleLines = new Set();

    for (const previousLine of possiblePreviousLines) {
      for (const currentLine of possibleCurrentLines) {
        if (previousLine === currentLine || isInterchange) { // You can either stay on the same line or change lines if it's an interchange station
          nextPossibleLines.add(currentLine);
        }
      }
    }

    if (nextPossibleLines.size === 0) return false;
    possiblePreviousLines = nextPossibleLines;
  }

  return true;
}

// This function validates a proposed route for a game by checking various conditions such as the route's structure, station and segment validity, and line change rules
export function validateRoute(game, route, network) {
  if (!Array.isArray(route) || route.length === 0) {
    return { valid: false, reason: "The route is empty" };
  }

  if (
    route.some( 
      (step) => step === null || typeof step !== "object" || Array.isArray(step),
    )
  ) {
    return { valid: false, reason: "The route contains an invalid segment" };
  }

  const stationIds = new Set(network.stations.map((station) => station.id));
  const segmentsByKey = new Map(
    network.segments.map((segment) => [segmentKey(segment.from, segment.to), segment]),
  );
  const usedSegments = new Set();

  if (route[0].from !== game.startStationId) {
    return { valid: false, reason: "The route does not start from the assigned station" };
  }

  if (route.at(-1).to !== game.destinationStationId) {
    return { valid: false, reason: "The route does not reach the destination station" };
  }

  for (let i = 0; i < route.length; i += 1) {
    const step = route[i];

    if (!Number.isInteger(step.from) || !Number.isInteger(step.to)) {
      return { valid: false, reason: "The route contains an invalid station id" };
    }

    if (!stationIds.has(step.from) || !stationIds.has(step.to)) {
      return { valid: false, reason: "The route contains an unknown station" };
    }

    if (step.from === step.to) {
      return { valid: false, reason: "A segment cannot start and end at the same station" };
    }

    if (i > 0 && route[i - 1].to !== step.from) {
      return { valid: false, reason: "The route segments are not consecutive" };
    }

    const key = segmentKey(step.from, step.to);
    if (!segmentsByKey.has(key)) {
      return { valid: false, reason: "The route uses a segment that does not exist" };
    }

    if (usedSegments.has(key)) {
      return { valid: false, reason: "The same segment cannot be used more than once" };
    }

    usedSegments.add(key);
  }

  const lineIdsByStation = getStationLineCounts(network);
  if (!canAssignLines(route, segmentsByKey, lineIdsByStation)) {
    return { valid: false, reason: "The route changes line outside an interchange station" };
  }

  return { valid: true };
}
