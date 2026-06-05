import { useEffect, useState } from "react";
import { getRanking } from "../API.js";

function RankingPage() {
  const [ranking, setRanking] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    getRanking()
      .then((data) => {
        if (active) setRanking(data);
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { // Cleanup function to prevent state updates if the component unmounts before the async operation completes
      active = false;
    };
  }, []);

  return (
    <section className="page-section">
      <div className="page-heading compact">
        <p className="eyebrow">Best completed games</p>
        <h1>Ranking</h1>
      </div>

      {error && <p className="error-message">{error}</p>}

      {loading && <p className="status-message">Loading ranking...</p>}

      {!loading && !error && ranking.length === 0 && (
        <p className="status-message">No completed games yet.</p>
      )}

      {ranking.length > 0 && (
        <table className="ranking-table">
          <thead>
            <tr>
              <th>Player</th>
              <th>Name</th>
              <th>Best score</th>
            </tr>
          </thead>
          <tbody>
            {ranking.map((row) => (
              <tr key={row.username}>
                <td>{row.username}</td>
                <td>{row.name}</td>
                <td>{row.bestScore}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

export default RankingPage;
