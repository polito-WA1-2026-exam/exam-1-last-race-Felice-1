import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getPlanningData, submitGameRoute } from "../API.js";
import NetworkMap from "../components/NetworkMap.jsx";

function segmentKey(from, to) {
  return [from, to].sort((a, b) => a - b).join("-");
}

function stationName(stations, id) {
  return stations.find((station) => station.id === id)?.name ?? `Station ${id}`;
}

function PlanningPage() {
  const { gameId } = useParams();
  const navigate = useNavigate(); // Hook to programmatically navigate to ExecutionPage or ResultPage after submitting the route
  const [game, setGame] = useState(null);
  const [network, setNetwork] = useState(null);
  const [route, setRoute] = useState([]);
  const [secondsLeft, setSecondsLeft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    getPlanningData(gameId)
      .then((data) => {
        if (!active) return;
        setGame(data.game);
        setNetwork(data.network);
        const millisecondsLeft = Date.parse(data.game.planningDeadline) - Date.now(); // Calculate the remaining time using the planning deadline from the game data
        setSecondsLeft(Math.max(0, Math.ceil(millisecondsLeft / 1000)));
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [gameId]);

  const usedSegments = useMemo(
    () => new Set(route.map((step) => segmentKey(step.from, step.to))),
    [route],
  );

  const currentStationId = route.length > 0 ? route.at(-1).to : game?.startStationId;

  const handleSubmitRoute = useCallback(async () => {
    if (!game || submitting) return; // Prevent submitting if game data is not loaded or if a submission is already in progress

    setSubmitting(true);
    setError("");

    try {
      const routeResult = await submitGameRoute(game.id, route);
      if (routeResult.valid) navigate(`/games/${game.id}/execution`);
      else navigate(`/games/${game.id}/result`);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }, [game, navigate, route, submitting]);

  useEffect(() => {
    if (loading || submitting || secondsLeft === null) return undefined;

    const timerId = setTimeout(() => {
      if (secondsLeft <= 1) {
        setSecondsLeft(0);
        handleSubmitRoute();
      } else {
        setSecondsLeft((current) => current - 1);
      }
    }, 1000);

    return () => clearTimeout(timerId);
  }, [handleSubmitRoute, loading, secondsLeft, submitting]);

  function addSegment(segment) {
    if (currentStationId == null || submitting) return;

    const key = segmentKey(segment.from, segment.to);
    if (usedSegments.has(key)) return;

    if (segment.from === currentStationId) {
      setRoute((currentRoute) => [...currentRoute, { from: segment.from, to: segment.to }]);
    } else if (segment.to === currentStationId) {
      setRoute((currentRoute) => [...currentRoute, { from: segment.to, to: segment.from }]);
    }
  }

  function removeLastSegment() {
    setRoute((currentRoute) => currentRoute.slice(0, -1));
  }

  if (loading) {
    return (
      <section className="page-section">
        <p className="status-message">Loading planning data...</p>
      </section>
    );
  }

  return (
    <section className="page-section">
      <div className="split-heading">
        <div className="page-heading compact">
          <p className="eyebrow">Planning phase</p>
          <h1>Build your route</h1>
        </div>
        <div className="timer-box">{secondsLeft ?? 0}s</div>
      </div>

      {error && <p className="error-message">{error}</p>}

      {game && network && (
        <>
          <div className="planning-summary">
            <p>
              From <strong>{game.startStationName}</strong> to{" "}
              <strong>{game.destinationStationName}</strong>
            </p>
            <p>Current station: {stationName(network.stations, currentStationId)}</p>
          </div>

          <div className="planning-layout">
            <div className="map-panel">
              <NetworkMap
                network={network}
                showLines={false}
                showSegments={false}
                startStationId={game.startStationId}
                destinationStationId={game.destinationStationId}
                currentStationId={currentStationId}
              />
              <div className="map-legend">
                <span className="legend-start">Start</span>
                <span className="legend-current">Current</span>
                <span className="legend-destination">Destination</span>
              </div>
            </div>

            <aside className="planning-panel">
              <h2>Segments</h2>
              <div className="segment-list">
                {network.segments.map((segment) => {
                  const key = segmentKey(segment.from, segment.to);
                  const used = usedSegments.has(key);
                  const selectable =
                    !submitting &&
                    !used &&
                    (segment.from === currentStationId || segment.to === currentStationId);

                  return (
                    <button
                      type="button"
                      key={key}
                      className="segment-button"
                      disabled={!selectable}
                      onClick={() => addSegment(segment)}
                    >
                      {stationName(network.stations, segment.from)} -{" "}
                      {stationName(network.stations, segment.to)}
                      {used && <span>Used</span>}
                    </button>
                  );
                })}
              </div>
            </aside>
          </div>

          <div className="route-panel">
            <h2>Selected route</h2>
            {route.length === 0 ? (
              <p className="status-message">No segment selected yet.</p>
            ) : (
              <ol>
                {route.map((step, index) => (
                  <li key={`${step.from}-${step.to}-${index}`}>
                    {stationName(network.stations, step.from)} to{" "}
                    {stationName(network.stations, step.to)}
                  </li>
                ))}
              </ol>
            )}

            <div className="action-row button-group">
              <button
                type="button"
                className="secondary-button"
                onClick={removeLastSegment}
                disabled={route.length === 0 || submitting}
              >
                Undo last segment
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setRoute([])}
                disabled={route.length === 0 || submitting}
              >
                Clear route
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={handleSubmitRoute}
                disabled={submitting}
              >
                {submitting ? "Submitting..." : "Submit route"}
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

export default PlanningPage;
