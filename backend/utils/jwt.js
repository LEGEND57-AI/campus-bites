import jwt from "jsonwebtoken";
import crypto from "crypto";

// Prepared HMAC key objects, one per secret value.
//
// Given a string secret, jsonwebtoken first tries to parse it as a PEM public
// key, catches the failure, then builds a secret key -- on every call. That
// cost ~66 µs per verification (measured) against ~8 µs with a prepared
// KeyObject, and verification runs on every authenticated request, socket
// handshake and rate-limit identity check. The key is built from exactly the
// bytes jsonwebtoken itself would use (the UTF-8 string), so tokens are
// byte-for-byte identical and HS256-only verification is unchanged.
//
// Keyed by the secret itself, read from the environment at call time as
// before, so a changed secret takes effect immediately. A missing or empty
// secret is passed through untouched so jsonwebtoken reports it exactly as it
// always has. Key objects never leave this module.
const preparedKeys = new Map();

function hmacKey(secret) {
  if (typeof secret !== "string" || secret.length === 0) {
    return secret;
  }

  let key = preparedKeys.get(secret);

  if (!key) {
    // Only the access and refresh secrets are ever used; a bound keeps an
    // unexpected churn of values from growing the map.
    if (preparedKeys.size >= 4) preparedKeys.clear();

    key = crypto.createSecretKey(Buffer.from(secret, "utf8"));
    preparedKeys.set(secret, key);
  }

  return key;
}

/**
 * ACCESS TOKEN
 */
export function generateAccessToken(payload) {
  return jwt.sign(payload, hmacKey(process.env.JWT_SECRET), {
    algorithm: "HS256",
    expiresIn: process.env.ACCESS_TOKEN_EXPIRES || "15m",
  });
}

/**
 * REFRESH TOKEN
 */
export function generateRefreshToken(payload) {
  return jwt.sign(payload, hmacKey(process.env.JWT_REFRESH_SECRET), {
    algorithm: "HS256",
    expiresIn: process.env.REFRESH_TOKEN_EXPIRES || "30d",
  });
}

/**
 * VERIFY ACCESS TOKEN
 */
export function verifyAccessToken(token) {
  return jwt.verify(token, hmacKey(process.env.JWT_SECRET), {
    algorithms: ["HS256"],
  });
}

/**
 * VERIFY REFRESH TOKEN
 */
export function verifyRefreshToken(token) {
  return jwt.verify(token, hmacKey(process.env.JWT_REFRESH_SECRET), {
    algorithms: ["HS256"],
  });
}

/**
 * HASH REFRESH TOKEN
 */
export function hashRefreshToken(token) {
  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
}

/* ------------------------------------------------------------------
   BACKWARD COMPATIBILITY
   (Temporary - Remove after full migration)
------------------------------------------------------------------- */

export function generateToken(payload) {
  return generateAccessToken(payload);
}

export function verifyToken(token) {
  return verifyAccessToken(token);
}