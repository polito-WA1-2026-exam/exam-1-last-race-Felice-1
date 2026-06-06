import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getGameResult } from "../API.js";

function ResultPage() {
  const { gameId } = useParams();
  const [game, setGame] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    getGameResult(gameId)
      .then((data) => {
        if (active) setGame(data);
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

  if (loading) {
    return (
      <section className="page-section">
        <p className="status-message">Loading result...</p>
      </section>
    );
  }

  return (
    <section className="page-section result-page">
      <div className="page-heading compact">
        <p className="eyebrow">Result phase</p>
        <h1>Final score</h1>
      </div>

      {error && <p className="error-message">{error}</p>}

      {game && (
        <>
          <div className={game.status === "completed" ? "score-display success" : "score-display danger"}>
            <strong>{game.finalScore} coins</strong>
            <p>
              {game.status === "completed"
                ? `You reached ${game.destinationStationName}.`
                : game.failureReason}
            </p>
          </div>

          <div className="action-row button-group">
            <Link className="primary-button" to="/setup">
              Start a new game
            </Link>
            <Link className="secondary-button" to="/ranking">
              View ranking
            </Link>
          </div>
        </>
      )}
    </section>
  );
}

export default ResultPage;
