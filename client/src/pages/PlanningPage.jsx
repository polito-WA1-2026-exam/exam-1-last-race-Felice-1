import { useEffect, useState } from "react";
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

  // Fetch the game and network data when the component mounts and calculate the initial remaining time until the planning deadline. Handle loading and error states appropriately.
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

  const usedSegments = new Set(route.map((step) => segmentKey(step.from, step.to)));
  const currentStationId = route.length > 0 ? route.at(-1).to : game?.startStationId;

  async function handleSubmitRoute() {
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
  }

  // Set up an interval timer to update the remaining time until the planning deadline every second. If the deadline is reached, automatically submit the current route. Make sure to clear the timer when the component unmounts or when the dependencies change.
  useEffect(() => {
    if (loading || submitting || !game?.planningDeadline) return undefined;

    let timerId;
    let autoSubmitted = false;

    async function submitExpiredRoute() {
      if (autoSubmitted) return; // To avoid multiple submissions if the timer fires again before the first submission completes, we use an autoSubmitted flag to ensure we only submit once when the deadline is reached
      autoSubmitted = true;
      clearInterval(timerId);
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
    }

    function updateTimer() {
      const millisecondsLeft = Date.parse(game.planningDeadline) - Date.now();
      const nextSecondsLeft = Math.max(0, Math.ceil(millisecondsLeft / 1000));
      setSecondsLeft(nextSecondsLeft);

      if (nextSecondsLeft === 0) {
        submitExpiredRoute();
      }
    }

    updateTimer();
    timerId = setInterval(updateTimer, 1000);

    return () => clearInterval(timerId);
  }, [game, loading, navigate, route, submitting]);

  // Function to add a segment to the current route. Check if the segment is valid (i.e., it connects to the current station and hasn't been used already) before adding it to the route state.
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

      {game && network && ( // Only render the planning interface if both game and network data are available, otherwise show an appropriate message
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
                selectedRoute={route}
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
