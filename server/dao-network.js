import { all } from "./db.js";

export async function getNetwork() {
  const stations = await all("SELECT id, name, x, y FROM stations ORDER BY id");
  const lines = await all("SELECT id, name, color FROM metro_lines ORDER BY id");
  const lineStations = await all(`
    SELECT ls.line_id, s.id, s.name, s.x, s.y, ls.position
    FROM line_stations ls
    JOIN stations s ON s.id = ls.station_id 
    ORDER BY ls.line_id, ls.position
  `);

  return {
    stations,
    lines: lines.map((line) => ({
      ...line,
      stations: lineStations
        .filter((station) => station.line_id === line.id)
        .map(({ line_id: _lineId, ...station }) => station), // Exclude line_id from station details
    })),
    segments: getSegmentsFromLineStations(lineStations),
  };
}

export async function getPlanningNetwork() {
  const network = await getNetwork();
  return {
    stations: network.stations,
    segments: network.segments.map(({ from, to }) => ({ from, to })), // Exclude lineIds for planning
  };
}

export function getSegmentsFromLineStations(lineStations) {
  const segmentsByKey = new Map();
  const grouped = Map.groupBy(lineStations, (station) => station.line_id); // Produces array of stations for each line

  for (const stations of grouped.values()) {
    for (let i = 0; i < stations.length - 1; i += 1) {
      const current = stations[i];
      const next = stations[i + 1];
      const [from, to] = [current.id, next.id].sort((a, b) => a - b); // This ensures that the segment key is consistent regardless of direction by sorting the station IDs
      const key = `${from}-${to}`;
      const segment = segmentsByKey.get(key) ?? { from, to, lineIds: [] };
      segment.lineIds.push(current.line_id);
      segmentsByKey.set(key, segment);
    }
  }

  return [...segmentsByKey.values()].sort((a, b) => a.from - b.from || a.to - b.to);
}

export function getAdjacency(segments) {
  const adjacency = new Map();

  for (const segment of segments) {
    if (!adjacency.has(segment.from)) adjacency.set(segment.from, []);
    if (!adjacency.has(segment.to)) adjacency.set(segment.to, []);
    adjacency.get(segment.from).push(segment.to);
    adjacency.get(segment.to).push(segment.from);
  }

  return adjacency;
}

export function shortestDistance(adjacency, startId, destinationId) { // BFS to find shortest path in unweighted graph
  const queue = [{ id: startId, distance: 0 }];
  const visited = new Set([startId]);

  while (queue.length > 0) {
    const current = queue.shift();
    if (current.id === destinationId) return current.distance;

    for (const neighbor of adjacency.get(current.id) ?? []) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push({ id: neighbor, distance: current.distance + 1 });
      }
    }
  }

  return Infinity;
}
