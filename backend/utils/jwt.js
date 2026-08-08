import jwt from "jsonwebtoken";
import crypto from "crypto";

/**
 * ACCESS TOKEN
 */
export function generateAccessToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    algorithm: "HS256",
    expiresIn: process.env.ACCESS_TOKEN_EXPIRES || "15m",
  });
}

/**
 * REFRESH TOKEN
 */
export function generateRefreshToken(payload) {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    algorithm: "HS256",
    expiresIn: process.env.REFRESH_TOKEN_EXPIRES || "30d",
  });
}

/**
 * VERIFY ACCESS TOKEN
 */
export function verifyAccessToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET, {
    algorithms: ["HS256"],
  });
}

/**
 * VERIFY REFRESH TOKEN
 */
export function verifyRefreshToken(token) {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET, {
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