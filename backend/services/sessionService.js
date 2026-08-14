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
    oldRefreshToken,
    newRefreshToken
) {

    const oldRefreshTokenHash = hashRefreshToken(oldRefreshToken);
    const newRefreshTokenHash = hashRefreshToken(newRefreshToken);

    // Compare-and-swap rotation.
    //
    // The row is rotated only if its stored hash is STILL the token this
    // request presented. Two concurrent refreshes carrying the same old token
    // both reach this statement, but Postgres serialises them on the row
    // lock: the second re-evaluates its WHERE clause against the row version
    // the first already committed, no longer matches
    // `refresh_token_hash = <old>`, and updates zero rows. Exactly one
    // rotation can ever succeed for a given old token.
    //
    // The old hash is derived from the caller's own token rather than from a
    // preceding SELECT, which is what removes the read-then-write window: an
    // earlier read could go stale between the read and the update, but a
    // value carried in the WHERE clause is evaluated atomically with the
    // write itself.
    const { data, error } = await supabase
        .from("user_sessions")
        .update({
            previous_token_hash:
                oldRefreshTokenHash,

            refresh_token_hash:
                newRefreshTokenHash,

            last_used:
                new Date().toISOString(),
        })
        .eq("id", sessionId)
        .eq("refresh_token_hash", oldRefreshTokenHash)
        .eq("revoked", false)
        .select()
        .maybeSingle();

    if (error) {
        throw new Error(
            `Failed to update refresh token: ${error.message}`
        );
    }

    // null means this request did not rotate the token: either a concurrent
    // request already consumed the same old token, or the session was revoked
    // or deleted in the meantime. maybeSingle() (not single()) is required
    // here so that "no row matched" is a normal null result rather than a
    // thrown error. The caller must treat null as a failed refresh.
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