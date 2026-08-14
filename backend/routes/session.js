import express from "express";

import {
    verifyRefreshToken,
    generateAccessToken,
    generateRefreshToken,
} from "../utils/jwt.js";

import {
    findSession,
    detectRefreshTokenReuse,
    revokeSession,
    revokeAllSessions,
    updateSessionRefreshToken,
} from "../services/sessionService.js";

import { authenticate } from "../middleware/auth.js";
import { requireTrustedOrigin } from "../middleware/requireTrustedOrigin.js";
import { sessionLimiter } from "../middleware/rateLimiter.js";
import { supabase } from "../db.js";

const router = express.Router();

router.use(sessionLimiter);

// How long after a successful rotation a presentation of that session's
// immediately previous refresh token is treated as a benign concurrent
// refresh rather than as token theft.
//
// Access tokens expire on a fixed schedule, so a user with several tabs open
// will routinely have two of them refresh the same cookie at almost the same
// moment. The loser of that race presents a token that is no longer current
// but IS the session's previous one -- indistinguishable, by value alone,
// from a stolen token being replayed. Only timing separates the two cases.
//
// Kept deliberately short. It suppresses nothing except the all-sessions
// revocation, and never causes a token to be issued.
const REFRESH_REUSE_GRACE_MS = 10_000;

// Cookie policy for the refresh-token cookie.
//
// SameSite=None requires Secure -- browsers reject that combination
// outright, so it can never be used over plain HTTP (e.g. local dev on
// http://localhost). Production serves the frontend and backend as
// separate HTTPS origins, which requires SameSite=None + Secure to
// allow the browser to send the cookie cross-site at all. Locally,
// same-site Lax is both sufficient (frontend/backend share the
// `localhost` host) and actually deliverable.
export function getRefreshCookieOptions() {
  const isProduction = process.env.NODE_ENV === "production";

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge: 1000 * 60 * 60 * 24 * 30,
  };
}

router.post("/refresh", requireTrustedOrigin, async (req, res) => {

    try {

        const refreshToken = req.cookies.refreshToken;

        if (!refreshToken) {
            return res.status(400).json({
                error: "Refresh token required",
            });
        }

        // Verify JWT
        const payload = verifyRefreshToken(refreshToken);

        if (!payload.userId || !payload.sessionId) {
            return res.status(401).json({
                error: "Invalid refresh token",
            });
        }

        // Find Session
        const session = await findSession(refreshToken);

        if (!session) {

            const reusedSession =
                await detectRefreshTokenReuse(
                    refreshToken
                );

            if (reusedSession) {

                // `last_used` is written in exactly one place -- the rotation
                // update in sessionService.updateSessionRefreshToken -- so it
                // is precisely "when this session last rotated". If that was
                // moments ago, another tab almost certainly just rotated this
                // same cookie, and revoking every session the user owns would
                // be a false positive.
                //
                // Date.parse yields NaN for a missing, null or malformed
                // value, and a rotation timestamp in the future indicates
                // something is wrong with the stored value. All of those fall
                // through to the genuine-reuse handling below, so the
                // uncertain case always fails safe rather than granting
                // leniency.
                const rotatedAtMs = Date.parse(reusedSession.last_used);
                const elapsedMs = Date.now() - rotatedAtMs;

                const withinGracePeriod =
                    Number.isFinite(rotatedAtMs) &&
                    elapsedMs >= 0 &&
                    elapsedMs <= REFRESH_REUSE_GRACE_MS;

                if (withinGracePeriod) {
                    // Benign concurrent refresh. This request still fails and
                    // is issued no token -- the grace period exists only to
                    // avoid a false-positive global revocation, never to
                    // recover a superseded token. The client's next attempt
                    // carries the already-rotated cookie and succeeds.
                    //
                    // Reported with the same generic failure used elsewhere in
                    // this handler so the response reveals nothing about which
                    // condition occurred.
                    return res.status(401).json({
                        error: "Invalid or expired refresh token",
                    });
                }

                await revokeAllSessions(
                    reusedSession.user_id
                );

                return res
                    .clearCookie("refreshToken")
                    .status(401)
                    .json({
                        error:
                            "Refresh token reuse detected. All sessions revoked.",
                    });

            }

            return res.status(401).json({
                error: "Invalid session",
            });

        }


        // Security check
        if (session.id !== payload.sessionId) {
            return res.status(401).json({
                error: "Session mismatch",
            });
        }

        // Get latest user
        const { data: user, error } = await supabase
            .from("users")
            .select("id, role")
            .eq("id", payload.userId)
            .single();

        if (error || !user) {
            return res.status(401).json({
                error: "User not found",
            });
        }

        // Generate new access token
        const accessToken = generateAccessToken({
            userId: user.id,
            role: user.role,
        });

        // Generate new refresh token (Rotation)
        const newRefreshToken = generateRefreshToken({
            userId: user.id,
            sessionId: session.id,
        });

        // Save new refresh token hash.
        //
        // This is a conditional (compare-and-swap) update keyed on the OLD
        // token still being the session's current one, so two concurrent
        // refreshes presenting the same old token cannot both rotate it.
        const updatedSession =
            await updateSessionRefreshToken(
                session.id,
                refreshToken,
                newRefreshToken
            );

        if (!updatedSession) {
            // Either a concurrent request already rotated this exact token,
            // or the session was revoked/deleted between lookup and update.
            // Both are reported with the same generic failure used elsewhere
            // in this handler, so the response never reveals which occurred
            // or whether any particular session exists.
            return res.status(401).json({
                error: "Invalid or expired refresh token",
            });
        }

        return res
            .cookie(
                "refreshToken",
                newRefreshToken,
                getRefreshCookieOptions()
            )
            .json({
                accessToken,
            });

    } catch (error) {

        console.error(
            "Refresh Error:",
            error.message
        );

        return res.status(401).json({
            error: "Invalid or expired refresh token",
        });

    }

});

router.post("/logout", requireTrustedOrigin, async (req, res) => {

    try {

        const refreshToken = req.cookies.refreshToken;

        if (!refreshToken) {
            return res.status(400).json({
                error: "Refresh token required",
            });
        }

        const payload = verifyRefreshToken(refreshToken);

        const session = await findSession(refreshToken);

        if (!session) {
            return res.status(401).json({
                error: "Invalid session",
            });
        }

        if (session.id !== payload.sessionId) {
            return res.status(401).json({
                error: "Session mismatch",
            });
        }

        await revokeSession(session.id);

        return res
            .clearCookie("refreshToken")
            .json({
                message: "Logged out successfully",
            });

    } catch (error) {

        console.error("Logout Error:", error.message);

        return res.status(401).json({
            error: "Invalid refresh token",
        });

    }

});

router.post("/logout-all", authenticate, async (req, res) => {

    try {

        await revokeAllSessions(req.user.id);

        return res
            .clearCookie("refreshToken")
            .json({
                message: "Logged out from all devices",
            });

    } catch (error) {

        console.error("Logout All Error:", error);

        return res.status(500).json({
            error: "Logout all failed",
        });

    }

});

export default router;