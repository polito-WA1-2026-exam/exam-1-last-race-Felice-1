import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { getCurrentUser, logout } from "./API.js";
import Navigation from "./components/Navigation.jsx";
import HomePage from "./pages/HomePage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import NotFoundPage from "./pages/NotFoundPage.jsx";
import PlanningPage from "./pages/PlanningPage.jsx";
import RankingPage from "./pages/RankingPage.jsx";
import SetupPage from "./pages/SetupPage.jsx";
import "./App.css";

function ProtectedRoute({ user, children }) {
  if (!user) return <Navigate to="/login" replace />; // Replace the current entry in the history stack to prevent going back to the protected page after login
  return children;
}

function App() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null); // Logged user state or null
  const [checkingSession, setCheckingSession] = useState(true); // State to indicate if session is being checked

  useEffect(() => {
    let active = true;

    getCurrentUser()
      .then((loggedUser) => {
        if (active) setUser(loggedUser);
      })
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setCheckingSession(false);
      });

    return () => { // Cleanup function to prevent state updates if the component unmounts before the async operation completes
      active = false;
    };
  }, []);

  async function handleLogout() {
    await logout();
    setUser(null);
    navigate("/");
  }

  if (checkingSession) {
    return <main className="app-shell loading-view">Loading...</main>;
  }

  return (
    <div className="app-shell">
      <Navigation user={user} onLogout={handleLogout} />
      <main>
        <Routes>
          <Route path="/" element={<HomePage user={user} />} />
          <Route path="/login" element={<LoginPage user={user} onLogin={setUser} />} />
          <Route
            path="/setup"
            element={
              <ProtectedRoute user={user}>
                <SetupPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ranking"
            element={
              <ProtectedRoute user={user}>
                <RankingPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/games/:gameId/planning"
            element={
              <ProtectedRoute user={user}>
                <PlanningPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
