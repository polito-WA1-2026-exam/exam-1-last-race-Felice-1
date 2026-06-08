import { Link, NavLink } from "react-router-dom";

function Navigation({ user, onLogout }) {
  return (
    <header className="top-bar">
      <Link className="brand" to="/">
        Last Race
      </Link>

      <nav className="main-nav" aria-label="Main navigation">
        {user && <NavLink to="/setup">Setup</NavLink>}
        {user && <NavLink to="/ranking">Ranking</NavLink>}
      </nav>

      <div className="session-box">
        {user ? (
          <>
            <span>{user.name}</span>
            <button type="button" className="secondary-button" onClick={onLogout}>
              Logout
            </button>
          </>
        ) : (
          <Link className="primary-button" to="/login">
            Login
          </Link>
        )}
      </div>
    </header>
  );
}

export default Navigation;
