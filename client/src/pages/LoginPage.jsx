import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { login } from "../API.js";

function LoginPage({ user, onLogin }) {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [waiting, setWaiting] = useState(false);

  if (user) return <Navigate to="/setup" replace />;

  async function handleSubmit(event) {
    event.preventDefault();
    setWaiting(true);
    setError("");

    try {
      const loggedUser = await login({ username: username.trim(), password });
      onLogin(loggedUser);
      navigate("/setup");
    } catch (err) {
      setError(err.message);
    } finally {
      setWaiting(false);
    }
  }

  return (
    <section className="auth-layout">
      <form className="login-form" onSubmit={handleSubmit}>
        <div className="page-heading compact">
          <p className="eyebrow">Registered users</p>
          <h1>Login</h1>
        </div>

        <label>
          Username
          <input
            required
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
        </label>

        <label>
          Password
          <input
            type="password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>

        {error && <p className="error-message">{error}</p>}

        <button type="submit" className="primary-button" disabled={waiting}>
          {waiting ? "Logging in..." : "Login"}
        </button>
      </form>
    </section>
  );
}

export default LoginPage;
