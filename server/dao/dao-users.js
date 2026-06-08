import { get } from "./db.js";
import { verifyPassword } from "../password.js";

export async function getUserById(id) {
  const user = await get("SELECT id, username, name FROM users WHERE id = ?", [id]);
  return user ?? false; // Return false if user not found
}

export async function getUserByCredentials(username, password) {
  const user = await get("SELECT * FROM users WHERE username = ?", [username.trim()]);
  if (!user) return false;

  const valid = await verifyPassword(password, user.password_salt, user.password_hash);
  if (!valid) return false;

  return {
    id: user.id,
    username: user.username,
    name: user.name,
  };
}
