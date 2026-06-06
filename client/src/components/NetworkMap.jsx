function stationById(stations, id) {
  return stations.find((station) => station.id === id);
}

function NetworkMap({
  network,
  showLines = true,
  showSegments = true,
  startStationId,
  destinationStationId,
  currentStationId,
}) {
  if (!network) return null;

  return (
    <svg className="network-map" viewBox="80 70 760 520" role="img" aria-label="Metro network map">
      {showLines &&
        network.lines.map((line) => (
          <polyline
            key={line.id}
            points={line.stations.map((station) => `${station.x},${station.y}`).join(" ")} // Transform station coordinates into a string of points for the polyline
            fill="none"
            stroke={line.color} // Use the line's color for the stroke
            strokeWidth="12"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}

      {showSegments &&
        network.segments?.map((segment) => {
          const from = stationById(network.stations, segment.from);
          const to = stationById(network.stations, segment.to);
          if (!from || !to) return null;

          return (
            <line
              key={`${segment.from}-${segment.to}`}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              className={showLines ? "segment-shadow" : "segment-muted"} // Change style based on whether lines are shown or not
            />
          );
        })}

      {network.stations.map((station) => (
        <g key={station.id}>
          <circle
            cx={station.x}
            cy={station.y}
            r="12"
            className={[
              "station-dot",
              station.id === startStationId ? "start-station" : "",
              station.id === destinationStationId ? "destination-station" : "",
              station.id === currentStationId ? "current-station" : "",
            ].join(" ")}
          />
          <text x={station.x + 16} y={station.y - 10} className="station-label">
            {station.name}
          </text>
        </g>
      ))}
    </svg>
  );
}

export default NetworkMap;
