import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { getPlanningData, submitGameRoute } from "../API.js";
import NetworkMap from "../components/NetworkMap.jsx";

function segmentKey(from, to) {
  return [from, to].sort((a, b) => a - b).join("-");
}

function stationName(stations, id) {
  return stations.find((station) => station.id === id)?.name ?? `Station ${id}`; // Fallback to "Station {id}" if the station is not found, to avoid displaying undefined in the UI
}

function PlanningPage() {
  const { gameId } = useParams(); // Get the gameId from the URL parameters using useParams hook from react-router-dom
  const [game, setGame] = useState(null);
  const [network, setNetwork] = useState(null);
  const [route, setRoute] = useState([]);
  const [secondsLeft, setSecondsLeft] = useState(90);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    getPlanningData(gameId)
      .then((data) => {
        if (!active) return;
        setGame(data.game);
        setNetwork(data.network);
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

  const usedSegments = useMemo( // Compute the set of used segments based on the current route, to easily check if a segment has already been used
    () => new Set(route.map((step) => segmentKey(step.from, step.to))),
    [route],
  );

  const currentStationId = route.length > 0 ? route.at(-1).to : game?.startStationId;

  const handleSubmitRoute = useCallback(async () => {
    if (!game || submitted || submitting) return;

    setSubmitting(true);
    setError("");

    try {
      const routeResult = await submitGameRoute(game.id, route);
      setResult(routeResult);
      setSubmitted(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }, [game, route, submitted, submitting]);

  useEffect(() => { // Timer effect to count down the seconds left for planning, and automatically submit the route when time runs out
    if (loading || submitted || result) return undefined;

    if (secondsLeft === 0) return undefined;

    const timerId = setTimeout(() => {
      if (secondsLeft === 1) handleSubmitRoute();
      setSecondsLeft((current) => current - 1);
    }, 1000);

    return () => clearTimeout(timerId);
  }, [handleSubmitRoute, loading, result, secondsLeft, submitted]);

  function addSegment(segment) {
    if (currentStationId == null || submitted) return;

    const key = segmentKey(segment.from, segment.to);
    if (usedSegments.has(key)) return;

    if (segment.from === currentStationId) {
      setRoute((currentRoute) => [...currentRoute, { from: segment.from, to: segment.to }]); // Destructure the segment object to ensure we are always adding segments in the direction of travel
    } else if (segment.to === currentStationId) {
      setRoute((currentRoute) => [...currentRoute, { from: segment.to, to: segment.from }]); // This allows the user to select segments in either direction, and we will normalize it to always add it in the direction of travel based on the current station
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
        <div className="timer-box">{secondsLeft}s</div>
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
              <NetworkMap network={network} showLines={false} showSegments={false} />
            </div>

            <aside className="planning-panel">
              <h2>Segments</h2>
              <div className="segment-list">
                {network.segments.map((segment) => {
                  const key = segmentKey(segment.from, segment.to);
                  const used = usedSegments.has(key);
                  const selectable =
                    !submitted &&
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

            <div className="action-row">
              <button
                type="button"
                className="secondary-button"
                onClick={removeLastSegment}
                disabled={route.length === 0 || submitted}
              >
                Undo last segment
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={handleSubmitRoute}
                disabled={submitted || submitting}
              >
                {submitting ? "Submitting..." : "Submit route"}
              </button>
            </div>
          </div>

          {result && (
            <div className={result.valid ? "result-box success" : "result-box danger"}>
              {result.valid ? (
                <p>Valid route. Final score: {result.finalScore} coins.</p>
              ) : (
                <p>Invalid route: {result.reason}. Final score: 0 coins.</p>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}

export default PlanningPage;
