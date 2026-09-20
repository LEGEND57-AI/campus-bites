// Google sign-in credential verification.
//
// Run with:  npm test          (see backend/package.json)
//
// Nothing here touches the network or Supabase. `global.fetch` is replaced per
// test, and ../db.js and ../services/sessionService.js are mocked before
// routes/auth.js is ever imported -- deliberately, because the real modules
// talk to the live project and the /google route creates user rows.

import { test, describe, before, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import bcrypt from "bcrypt";

// The audience every token in this file is measured against. Set before
// anything imports routes/auth.js, which reads it through validateEnv.
const CLIENT_ID = "campuscraves-test-client.apps.googleusercontent.com";
const OTHER_CLIENT_ID = "some-other-app.apps.googleusercontent.com";

process.env.GOOGLE_CLIENT_ID = CLIENT_ID;

// routes/auth.js -> utils/jwt.js needs these to sign. Values are irrelevant;
// only that signing succeeds.
process.env.JWT_SECRET ||= "test-access-secret";
process.env.JWT_REFRESH_SECRET ||= "test-refresh-secret";

// ---------------------------------------------------------------------------
// fetch stubbing
// ---------------------------------------------------------------------------

const realFetch = global.fetch;

// Records every URL the code under test requested, so a test can assert what
// was asked of Google -- in particular that the token went to tokeninfo.
let fetchCalls = [];

function stubFetch(handler) {
  global.fetch = async (url, ...rest) => {
    fetchCalls.push(String(url));
    return handler(String(url), ...rest);
  };
}

function jsonResponse(body, ok = true, status = ok ? 200 : 400) {
  return {
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

// A tokeninfo body for a good token, with fields overridable per test.
function tokeninfoBody(overrides = {}) {
  return {
    aud: CLIENT_ID,
    azp: CLIENT_ID,
    sub: "1234567890",
    scope: "openid profile email",
    exp: String(Math.floor(Date.now() / 1000) + 3600),
    email: "student@example.com",
    email_verified: "true",
    ...overrides,
  };
}

// Answers tokeninfo with `info`, and userinfo with a display name.
function stubGoogle(info, { tokeninfoOk = true, userinfoOk = true } = {}) {
  stubFetch(async (url) => {
    if (url.includes("tokeninfo")) {
      return jsonResponse(info, tokeninfoOk, tokeninfoOk ? 200 : 400);
    }

    if (url.includes("userinfo")) {
      return jsonResponse(
        { email: info?.email, name: "Test Student", picture: "https://x/y.png" },
        userinfoOk,
        userinfoOk ? 200 : 401
      );
    }

    throw new Error(`unexpected fetch to ${url}`);
  });
}

beforeEach(() => {
  fetchCalls = [];
});

afterEach(() => {
  global.fetch = realFetch;
});

// ---------------------------------------------------------------------------
// Supabase / session stubs, installed before routes/auth.js loads
// ---------------------------------------------------------------------------

// The single row the fake users table holds, or null for "no such user".
let userRow = null;
// Rows the route inserted during a test.
let insertedRows = [];
// Sessions createSession() was asked to persist.
let createdSessions = [];

// A minimal stand-in for the chained Supabase query builder, covering only the
// shapes routes/auth.js actually uses on the users table:
//   .from("users").select("*").eq("email", x).maybeSingle()
//   .from("users").select("*").eq("email", x).single()
//   .from("users").insert([row]).select().single()
function makeSupabaseStub() {
  return {
    from() {
      const builder = {
        _inserted: null,
        select() {
          return builder;
        },
        eq() {
          return builder;
        },
        insert(rows) {
          builder._inserted = rows[0];
          insertedRows.push(rows[0]);
          return builder;
        },
        async maybeSingle() {
          return { data: userRow, error: null };
        },
        async single() {
          if (builder._inserted) {
            const created = { id: "new-user-id", ...builder._inserted };
            return { data: created, error: null };
          }

          return userRow
            ? { data: userRow, error: null }
            : { data: null, error: { code: "PGRST116", message: "no rows" } };
        },
        async update() {
          return { data: null, error: null };
        },
      };

      return builder;
    },
  };
}

let authRouter;
let verifyGoogleAccessToken;
let app;
let server;
let baseUrl;

before(async () => {
  const dbUrl = new URL("../db.js", import.meta.url).href;
  const sessionServiceUrl = new URL(
    "../services/sessionService.js",
    import.meta.url
  ).href;
  const socketUrl = new URL("../socket/userSockets.js", import.meta.url).href;

  mock.module(dbUrl, {
    namedExports: { supabase: makeSupabaseStub() },
  });

  // The full named-export surface of the real module. routes/session.js is
  // imported transitively by routes/auth.js (for getRefreshCookieOptions) and
  // binds several of these at load time, so a partial mock fails to link.
  mock.module(sessionServiceUrl, {
    namedExports: {
      createSession: async (session) => {
        createdSessions.push(session);
        return { id: session.sessionId };
      },
      findSession: async () => null,
      detectRefreshTokenReuse: async () => false,
      updateLastUsed: async () => {},
      revokeSession: async () => {},
      revokeAllSessions: async () => {},
      updateSessionRefreshToken: async () => {},
      deleteExpiredSessions: async () => {},
      isSessionExpired: () => false,
    },
  });

  mock.module(socketUrl, {
    namedExports: {
      disconnectUserSockets: () => {},
      handshakePredatesSweep: () => false,
    },
  });

  const mod = await import("../routes/auth.js");

  authRouter = mod.default;
  verifyGoogleAccessToken = mod.verifyGoogleAccessToken;

  app = express();
  app.use(express.json());
  app.use("/api/auth", authRouter);

  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });

  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => {
  server?.close();
});

// Posts to the route using the real fetch, not the stubbed one -- the stub is
// for the server's outbound calls to Google.
async function postGoogle(body) {
  const res = await realFetch(`${baseUrl}/api/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  return { status: res.status, body: await res.json().catch(() => null) };
}

async function postLogin(body) {
  const res = await realFetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  return { status: res.status, body: await res.json().catch(() => null) };
}

// ===========================================================================
// verifyGoogleAccessToken -- the audience check itself
// ===========================================================================

describe("verifyGoogleAccessToken", () => {
  test("accepts a token issued for this client with a verified email", async () => {
    stubGoogle(tokeninfoBody());

    const result = await verifyGoogleAccessToken("good-token");

    assert.equal(result.ok, true);
    assert.equal(result.email, "student@example.com");
  });

  test("sends the token to tokeninfo, not only userinfo", async () => {
    stubGoogle(tokeninfoBody());

    await verifyGoogleAccessToken("good-token");

    assert.equal(
      fetchCalls.some((u) => u.includes("tokeninfo")),
      true,
      "verification must consult Google's tokeninfo endpoint"
    );
  });

  test("checks the audience against GOOGLE_CLIENT_ID from the environment", async () => {
    // Proves the expected audience is read from configuration rather than
    // hardcoded: with a different GOOGLE_CLIENT_ID, the same token fails.
    stubGoogle(tokeninfoBody());

    const original = process.env.GOOGLE_CLIENT_ID;
    process.env.GOOGLE_CLIENT_ID = "a-completely-different-client-id";

    const result = await verifyGoogleAccessToken("good-token");

    process.env.GOOGLE_CLIENT_ID = original;

    assert.equal(result.ok, false);
    assert.match(result.reason, /audience/i);
  });

  // ---- REGRESSION: the vulnerability this change exists to close ----
  test("REGRESSION: rejects a valid token issued for another OAuth client", async () => {
    // This token is entirely legitimate -- Google signed it, it is unexpired,
    // and its email is verified. It simply belongs to a different application.
    // Before the fix, userinfo answered 200 for exactly this token and the
    // holder was signed in as its owner.
    stubGoogle(tokeninfoBody({ aud: OTHER_CLIENT_ID, azp: OTHER_CLIENT_ID }));

    const result = await verifyGoogleAccessToken("another-apps-token");

    assert.equal(result.ok, false, "a foreign-audience token must be refused");
    assert.match(result.reason, /audience/i);
  });

  test("rejects an expired or revoked token (tokeninfo answers non-2xx)", async () => {
    stubGoogle({ error: "invalid_token" }, { tokeninfoOk: false });

    const result = await verifyGoogleAccessToken("expired-token");

    assert.equal(result.ok, false);
  });

  test("rejects a malformed token", async () => {
    stubGoogle({ error_description: "Invalid Value" }, { tokeninfoOk: false });

    const result = await verifyGoogleAccessToken("!!!not-a-token!!!");

    assert.equal(result.ok, false);
  });

  test("rejects a token carrying no email", async () => {
    const body = tokeninfoBody();
    delete body.email;

    stubGoogle(body);

    const result = await verifyGoogleAccessToken("no-email-token");

    assert.equal(result.ok, false);
    assert.match(result.reason, /email/i);
  });

  test("rejects email_verified = false", async () => {
    stubGoogle(tokeninfoBody({ email_verified: "false" }));

    const result = await verifyGoogleAccessToken("unverified-token");

    assert.equal(result.ok, false);
    assert.match(result.reason, /verified/i);
  });

  test("rejects a missing email_verified claim (fails closed)", async () => {
    const body = tokeninfoBody();
    delete body.email_verified;

    stubGoogle(body);

    const result = await verifyGoogleAccessToken("no-claim-token");

    assert.equal(result.ok, false);
    assert.match(result.reason, /verified/i);
  });

  test("accepts boolean true as well as the string \"true\"", async () => {
    stubGoogle(tokeninfoBody({ email_verified: true }));

    const result = await verifyGoogleAccessToken("bool-token");

    assert.equal(result.ok, true);
  });

  test("does not treat an arbitrary truthy email_verified as verified", async () => {
    stubGoogle(tokeninfoBody({ email_verified: "yes" }));

    const result = await verifyGoogleAccessToken("weird-token");

    assert.equal(result.ok, false);
  });

  test("fails closed when GOOGLE_CLIENT_ID is unset", async () => {
    stubGoogle(tokeninfoBody());

    const original = process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_ID;

    const result = await verifyGoogleAccessToken("good-token");

    process.env.GOOGLE_CLIENT_ID = original;

    assert.equal(result.ok, false);
    assert.equal(
      fetchCalls.length,
      0,
      "must refuse before contacting Google at all"
    );
  });

  test("rejects when the network call to Google throws", async () => {
    stubFetch(async () => {
      throw new Error("ECONNREFUSED");
    });

    const result = await verifyGoogleAccessToken("good-token");

    assert.equal(result.ok, false);
  });
});

// ===========================================================================
// POST /api/auth/google -- route behavior
// ===========================================================================

describe("POST /api/auth/google", () => {
  beforeEach(() => {
    userRow = null;
    insertedRows = [];
    createdSessions = [];
  });

  test("rejects a missing token with 400", async () => {
    stubGoogle(tokeninfoBody());

    const { status, body } = await postGoogle({});

    assert.equal(status, 400);
    assert.equal(fetchCalls.length, 0, "must not call Google without a token");
    assert.ok(body.error);
  });

  test("rejects a foreign-audience token with 401 and creates no user", async () => {
    stubGoogle(tokeninfoBody({ aud: OTHER_CLIENT_ID }));

    const { status } = await postGoogle({ accessToken: "another-apps-token" });

    assert.equal(status, 401);
    assert.deepEqual(insertedRows, [], "no account may be created");
    assert.deepEqual(createdSessions, [], "no session may be issued");
  });

  test("rejects email_verified = false with 401 and creates no user", async () => {
    stubGoogle(tokeninfoBody({ email_verified: "false" }));

    const { status } = await postGoogle({ accessToken: "unverified-token" });

    assert.equal(status, 401);
    assert.deepEqual(insertedRows, []);
    assert.deepEqual(createdSessions, []);
  });

  test("creates a Google user and returns the expected session response", async () => {
    userRow = null; // no existing account
    stubGoogle(tokeninfoBody());

    const { status, body } = await postGoogle({ accessToken: "good-token" });

    assert.equal(status, 200);

    // Response shape is unchanged: accessToken + user, password_hash stripped.
    assert.equal(typeof body.accessToken, "string");
    assert.ok(body.user);
    assert.equal(body.user.email, "student@example.com");
    assert.equal(
      Object.prototype.hasOwnProperty.call(body.user, "password_hash"),
      false,
      "password_hash must never be returned"
    );

    // User creation preserved, with the display name from userinfo.
    assert.equal(insertedRows.length, 1);
    assert.equal(insertedRows[0].email, "student@example.com");
    assert.equal(insertedRows[0].name, "Test Student");
    assert.equal(insertedRows[0].role, "student");
    assert.equal(insertedRows[0].is_verified, true);

    // Session creation preserved.
    assert.equal(createdSessions.length, 1);
  });

  test("signs in an existing Google user without creating a duplicate", async () => {
    userRow = {
      id: "existing-id",
      email: "student@example.com",
      name: "Existing Student",
      role: "student",
      is_verified: true,
      password_hash: null,
    };

    stubGoogle(tokeninfoBody());

    const { status, body } = await postGoogle({ accessToken: "good-token" });

    assert.equal(status, 200);
    assert.equal(body.user.id, "existing-id");
    assert.deepEqual(insertedRows, [], "must not re-create an existing user");
    assert.equal(createdSessions.length, 1);
  });

  test("identity comes from tokeninfo, not from userinfo", async () => {
    // userinfo claims a different address than the verified token. The account
    // must key on the verified one.
    userRow = null;

    stubFetch(async (url) => {
      if (url.includes("tokeninfo")) {
        return jsonResponse(tokeninfoBody({ email: "real@example.com" }));
      }

      return jsonResponse({
        email: "attacker@evil.example",
        name: "Test Student",
      });
    });

    const { status, body } = await postGoogle({ accessToken: "good-token" });

    assert.equal(status, 200);
    assert.equal(body.user.email, "real@example.com");
    assert.equal(insertedRows[0].email, "real@example.com");
  });

  test("leaks no token, payload or internal reason to the client", async () => {
    const secretToken = "ya29.SUPER-SECRET-ACCESS-TOKEN";

    stubGoogle(tokeninfoBody({ aud: OTHER_CLIENT_ID }));

    const { status, body } = await postGoogle({ accessToken: secretToken });

    assert.equal(status, 401);

    const serialized = JSON.stringify(body);

    assert.equal(serialized.includes(secretToken), false, "token leaked");
    assert.equal(serialized.includes(OTHER_CLIENT_ID), false, "aud leaked");
    assert.equal(serialized.includes("audience"), false, "reason leaked");
    assert.equal(/stack|at \w+ \(/i.test(serialized), false, "stack leaked");

    // The generic refusal is the same one an expired token produces.
    assert.deepEqual(Object.keys(body), ["error"]);
  });

  test("does not log the access token", async () => {
    const secretToken = "ya29.ANOTHER-SECRET-TOKEN";
    const logged = [];
    const originalError = console.error;

    console.error = (...args) => {
      logged.push(args.map(String).join(" "));
    };

    stubGoogle(tokeninfoBody({ aud: OTHER_CLIENT_ID }));

    try {
      await postGoogle({ accessToken: secretToken });
    } finally {
      console.error = originalError;
    }

    assert.equal(
      logged.some((line) => line.includes(secretToken)),
      false,
      "the access token must never reach the log"
    );
  });
});

// ===========================================================================
// Regression: email/password login is untouched
// ===========================================================================

describe("POST /api/auth/login (regression)", () => {
  beforeEach(() => {
    userRow = null;
    createdSessions = [];
  });

  test("a correct password still signs in", async () => {
    const password = "correct-horse-battery";

    userRow = {
      id: "pw-user-id",
      email: "pwuser@example.com",
      name: "Password User",
      role: "student",
      is_verified: true,
      password_hash: await bcrypt.hash(password, 10),
    };

    const { status, body } = await postLogin({
      email: "pwuser@example.com",
      password,
    });

    assert.equal(status, 200);
    assert.equal(typeof body.accessToken, "string");
    assert.equal(body.user.id, "pw-user-id");
    assert.equal(
      Object.prototype.hasOwnProperty.call(body.user, "password_hash"),
      false
    );
  });

  test("a wrong password is still refused", async () => {
    userRow = {
      id: "pw-user-id",
      email: "pwuser@example.com",
      role: "student",
      is_verified: true,
      password_hash: await bcrypt.hash("the-right-one", 10),
    };

    const { status } = await postLogin({
      email: "pwuser@example.com",
      password: "the-wrong-one",
    });

    assert.equal(status, 401);
  });

  test("password login never consults Google", async () => {
    stubGoogle(tokeninfoBody());

    userRow = {
      id: "pw-user-id",
      email: "pwuser@example.com",
      role: "student",
      is_verified: true,
      password_hash: await bcrypt.hash("pw", 10),
    };

    await postLogin({ email: "pwuser@example.com", password: "pw" });

    assert.deepEqual(fetchCalls, []);
  });
});
