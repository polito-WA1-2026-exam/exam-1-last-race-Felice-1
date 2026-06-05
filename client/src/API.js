const API_URL = `${window.location.protocol}//${window.location.hostname}:3001/api`;

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    credentials: "include", // Allows cookies to be sent with requests
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  });

  if (response.status === 204) return null; // No content status code

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error ?? "Request failed");
  }

  return payload;
}

export function getInstructions() {
  return request("/instructions");
}

export function login(credentials) {
  return request("/sessions", {
    method: "POST",
    body: JSON.stringify(credentials),
  });
}

export function logout() {
  return request("/sessions/current", {
    method: "DELETE",
  });
}

export function getCurrentUser() {
  return request("/sessions/current");
}

export function getNetwork() {
  return request("/network");
}

export function createGame() {
  return request("/games", {
    method: "POST",
  });
}

export function getPlanningData(gameId) {
  return request(`/games/${gameId}/planning-data`);
}

export function submitGameRoute(gameId, route) {
  return request(`/games/${gameId}/route`, {
    method: "POST",
    body: JSON.stringify({ route }),
  });
}

export function getRanking() {
  return request("/ranking");
}
