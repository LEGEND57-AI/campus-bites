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
import { supabase } from "../db.js";

const router = express.Router();

router.post("/refresh", async (req, res) => {

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

        // Save new refresh token hash
        const updatedSession =
            await updateSessionRefreshToken(
                session.id,
                newRefreshToken
            );

        if (!updatedSession) {
            return res.status(401).json({
                error: "Session revoked",
            });
        }

        return res
            .cookie("refreshToken", newRefreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "none",
                maxAge: 1000 * 60 * 60 * 24 * 30,
            })
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

router.post("/logout", async (req, res) => {

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