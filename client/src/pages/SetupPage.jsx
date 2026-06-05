import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createGame, getNetwork } from "../API.js";
import NetworkMap from "../components/NetworkMap.jsx";

function SetupPage() {
  const navigate = useNavigate();
  const [network, setNetwork] = useState(null);
  const [error, setError] = useState("");
  const [waiting, setWaiting] = useState(false);
  const [loadingNetwork, setLoadingNetwork] = useState(true);

  useEffect(() => {
    let active = true;

    getNetwork()
      .then((data) => {
        if (active) setNetwork(data);
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoadingNetwork(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function handleStartGame() {
    setWaiting(true);
    setError("");

    try {
      const newGame = await createGame();
      navigate(`/games/${newGame.id}/planning`);
    } catch (err) {
      setError(err.message);
    } finally {
      setWaiting(false);
    }
  }

  return (
    <section className="page-section">
      <div className="split-heading">
        <div className="page-heading compact">
          <p className="eyebrow">Setup phase</p>
          <h1>Network map</h1>
        </div>
        <button
          type="button"
          className="primary-button"
          onClick={handleStartGame}
          disabled={waiting || !network}
        >
          {waiting ? "Starting..." : "Start game"}
        </button>
      </div>

      {error && <p className="error-message">{error}</p>}
      {loadingNetwork && <p className="status-message">Loading network...</p>}

      {network && (
        <div className="map-panel">
          <NetworkMap network={network} />
        </div>
      )}

    </section>
  );
}

export default SetupPage;
