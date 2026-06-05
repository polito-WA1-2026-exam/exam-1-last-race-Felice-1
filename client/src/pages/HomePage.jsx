import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getInstructions } from "../API.js";

function HomePage({ user }) {
  const [instructions, setInstructions] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    getInstructions()
      .then((data) => {
        if (active) setInstructions(data);
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
      <div className="page-heading">
        <p className="eyebrow">Single-player metro challenge</p>
        <h1>{instructions?.title ?? "Last Race"}</h1>
      </div>

      {error && <p className="error-message">{error}</p>}

      {loading && <p className="status-message">Loading instructions...</p>}

      {instructions && (
        <div className="instruction-grid">
          {instructions.text.map((item) => ( // Display each instruction item in a card-like format, or show nothing if instructions or text is not available
            <article className="info-card" key={item}>
              <p>{item}</p>
            </article>
          ))}
        </div>
      )}

      <div className="action-row">
        {user ? (
          <Link className="primary-button" to="/setup">
            View network
          </Link>
        ) : (
          <Link className="primary-button" to="/login">
            Login to play
          </Link>
        )}
      </div>
    </section>
  );
}

export default HomePage;
