import { supabase } from "../db.js";
import { hashRefreshToken } from "../utils/jwt.js";
import { v4 as uuidv4 } from "uuid";

/**
 * Create a new user session
 *
 * Stores ONLY the hashed refresh token.
 * Plain refresh tokens are NEVER stored.
 */
export async function createSession({
    sessionId,
    userId,
    refreshToken,
    expiresAt,
    deviceName = null,
    browser = null,
    ipAddress = null,
}) {

    const refreshTokenHash = hashRefreshToken(refreshToken);
    const tokenFamily = uuidv4();

    const { data, error } = await supabase
        .from("user_sessions")
        .insert({
            id: sessionId,
            user_id: userId,
            token_family: tokenFamily,
            previous_token_hash: null,
            refresh_token_hash: refreshTokenHash,
            device_name: deviceName,
            browser,
            ip_address: ipAddress,
            expires_at: expiresAt,
        })
        .select()
        .single();

    if (error) {
        throw new Error(
            `Failed to create session: ${error.message}`
        );
    }

    return data;
}


/**
 * Find a session using the refresh token
 */
export async function findSession(refreshToken) {

    const refreshTokenHash = hashRefreshToken(refreshToken);

    const { data, error } = await supabase
        .from("user_sessions")
        .select("*")
        .eq("refresh_token_hash", refreshTokenHash)
        .eq("revoked", false)
        .single();

    if (error || !data) {
        return null;
    }

    if (isSessionExpired(data)) {

        await supabase
            .from("user_sessions")
            .delete()
            .eq("id", data.id)
            .eq("revoked", false);

        return null;
    }

    return data;

}

export async function detectRefreshTokenReuse(
    refreshToken
) {

    const refreshTokenHash =
        hashRefreshToken(refreshToken);

    const { data, error } = await supabase
        .from("user_sessions")
        .select("*")
        .eq(
            "previous_token_hash",
            refreshTokenHash
        )
        .eq("revoked", false)
        .maybeSingle();

    if (error) {
        throw new Error(
            `Refresh token reuse detection failed: ${error.message}`
        );
    }

    return data;
}


/**
 * Update last used timestamp
 */
export async function updateLastUsed(sessionId) {

    const { error } = await supabase
        .from("user_sessions")
        .update({
            last_used: new Date().toISOString(),
        })
        .eq("id", sessionId)
        .eq("revoked", false);

    if (error) {
        throw new Error(
            `Failed to update session: ${error.message}`
        );
    }

}

/**
 * Revoke a single session
 */
export async function revokeSession(sessionId) {

    const { error } = await supabase
        .from("user_sessions")
        .update({
            revoked: true,
        })
        .eq("id", sessionId);

    if (error) {
        throw new Error(
            `Failed to revoke session: ${error.message}`
        );
    }

}


/**
 * Revoke all sessions for a user
 */
export async function revokeAllSessions(userId) {

    const { error } = await supabase
        .from("user_sessions")
        .update({
            revoked: true,
        })
        .eq("user_id", userId)
        .eq("revoked", false);

    if (error) {
        throw new Error(
            `Failed to revoke all sessions: ${error.message}`
        );
    }

}

/**
 * Update refresh token for a session
 */
export async function updateSessionRefreshToken(
    sessionId,
    refreshToken
) {

    const refreshTokenHash = hashRefreshToken(refreshToken);

    const { data: currentSession } = await supabase
        .from("user_sessions")
        .select("refresh_token_hash")
        .eq("id", sessionId)
        .single();

    if (!currentSession) {
        return null;
    }

    const { data, error } = await supabase
        .from("user_sessions")
        .update({
            previous_token_hash:
                currentSession.refresh_token_hash,

            refresh_token_hash:
                refreshTokenHash,

            last_used:
                new Date().toISOString(),
        })
        .eq("id", sessionId)
        .eq("revoked", false)
        .select()
        .single();

    if (error) {
        throw new Error(
            `Failed to update refresh token: ${error.message}`
        );
    }

    return data;

}

/**
 * Delete expired sessions
 *
 * Can be called from a scheduler (daily/hourly)
 * to keep the sessions table clean.
 */
export async function deleteExpiredSessions() {

    const { error } = await supabase
        .from("user_sessions")
        .delete()
        .lt("expires_at", new Date().toISOString());

    if (error) {
        throw new Error(
            `Failed to delete expired sessions: ${error.message}`
        );
    }

}


/**
 * Check whether a session is still valid
 */
export function isSessionExpired(session) {

    if (!session) {
        return true;
    }

    return new Date(session.expires_at) <= new Date();

}