import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getExecutionState, revealNextExecutionStep } from "../API.js";

function ExecutionPage() {
  const { gameId } = useParams();
  const [state, setState] = useState(null);
  const [currentStep, setCurrentStep] = useState(null);
  const [loading, setLoading] = useState(true);
  const [revealing, setRevealing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    getExecutionState(gameId)
      .then((data) => {
        if (!active) return;
        setState(data);
        setCurrentStep(data.revealedSteps.at(-1) ?? null);
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

  async function handleNextStep() {
    setRevealing(true);
    setError("");

    try {
      const result = await revealNextExecutionStep(gameId);
      setCurrentStep(result.step);
      setState((current) => ({
        ...current,
        game: {
          ...current.game,
          status: result.completed ? "completed" : current.game.status,
          finalScore: result.finalScore,
        },
        currentCoins: result.step.coinsAfter,
        revealedSteps: [...current.revealedSteps, result.step],
      }));
    } catch (err) {
      setError(err.message);
    } finally {
      setRevealing(false);
    }
  }

  if (loading) {
    return (
      <section className="page-section">
        <p className="status-message">Loading execution...</p>
      </section>
    );
  }

  const completed = state?.game.status === "completed";
  const revealedCount = state?.revealedSteps.length ?? 0;

  return (
    <section className="page-section execution-page">
      <div className="split-heading">
        <div className="page-heading compact">
          <p className="eyebrow">Execution phase</p>
          <h1>Ride the route</h1>
        </div>
        <div className="coin-box">{state?.currentCoins ?? 20} coins</div>
      </div>

      {error && <p className="error-message">{error}</p>}

      {state && (
        <>
          <p className="execution-progress">
            Step {revealedCount} of {state.totalSteps}
          </p>

          <div className="execution-stage">
            {currentStep ? (
              <>
                <p className="journey-label">
                  {currentStep.fromStationName} to {currentStep.toStationName}
                </p>
                <h2>{currentStep.eventDescription}</h2>
                <p className={currentStep.effect >= 0 ? "positive-effect" : "negative-effect"}>
                  {currentStep.effect >= 0 ? "+" : ""}
                  {currentStep.effect} coins
                </p>
                <p>Total: {currentStep.coinsAfter} coins</p>
              </>
            ) : (
              <p className="status-message">Ready to reveal the first journey event.</p>
            )}
          </div>

          <div className="action-row">
            {completed ? (
              <Link className="primary-button" to={`/games/${gameId}/result`}>
                View result
              </Link>
            ) : (
              <button
                type="button"
                className="primary-button"
                onClick={handleNextStep}
                disabled={revealing}
              >
                {revealing ? "Revealing..." : "Reveal next event"}
              </button>
            )}
          </div>
        </>
      )}
    </section>
  );
}

export default ExecutionPage;
