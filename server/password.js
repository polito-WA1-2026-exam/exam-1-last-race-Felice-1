import crypto from "crypto";

const KEY_LENGTH = 64;

export function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, KEY_LENGTH, (err, derivedKey) => {
      if (err) {
        reject(err);
        return;
      }

      resolve({ salt, hash: derivedKey.toString("hex") });
    });
  });
}

export function verifyPassword(password, salt, storedHash) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, KEY_LENGTH, (err, derivedKey) => {
      if (err) {
        reject(err);
        return;
      }

      const storedBuffer = Buffer.from(storedHash, "hex");
      if (derivedKey.length !== storedBuffer.length) {
        resolve(false);
        return;
      }

      resolve(crypto.timingSafeEqual(derivedKey, storedBuffer));
    });
  });
}
