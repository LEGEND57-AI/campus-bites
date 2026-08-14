import pino from "pino";

// Allowlist serializer for logged Error objects.
//
// pino's default `err` serializer copies every own enumerable property and
// walks the whole object graph -- it has no depth cutoff. HTTP client
// libraries hang their transport internals off the error they reject with,
// and those internals carry credentials:
//
//   superagent (used by the Brevo SDK) sets err.response.req to the
//   underlying http.ClientRequest, whose `_header` is a STRING holding the
//   raw outgoing header block -- including `api-key: <BREVO_API_KEY>`.
//
//   axios sets err.config.auth = { username, password } and err.request,
//   again reaching the raw header block.
//
// Serializing such an error with pino's default emits the credential in
// full, and more of it than console.error would (console truncates at
// util.inspect depth 2; pino does not truncate at all).
//
// A redact-path list cannot be relied on here: it requires enumerating every
// nested location a secret might occupy, and would silently miss the next
// library's shape. An allowlist inverts that -- unknown properties are
// dropped by default, so a new transport internal can never leak by being
// unanticipated.
//
// Kept deliberately small: these are the fields the codebase's own error
// handling actually reads (Supabase exposes `code`, Razorpay's normalized
// rejection exposes `statusCode`), plus what makes a stack trace useful.
function serializeError(err) {
    if (!err || typeof err !== "object") {
        return err;
    }

    const serialized = {
        type: err.constructor?.name ?? "Error",
        message: err.message,
        stack: err.stack,
    };

    if (err.code !== undefined) {
        serialized.code = err.code;
    }

    if (err.statusCode !== undefined) {
        serialized.statusCode = err.statusCode;
    }

    if (err.status !== undefined) {
        serialized.status = err.status;
    }

    // Causes are themselves Errors and carry the same risk, so they go
    // through this same allowlist rather than being passed through raw.
    if (err.cause) {
        serialized.cause = serializeError(err.cause);
    }

    return serialized;
}

const logger = pino({

    level: process.env.LOG_LEVEL || "info",

    // Applies anywhere an error is logged under the conventional `err` key,
    // which is the form used by the global handler in server.js, the Razorpay
    // webhook, and the admin socket recheck.
    serializers: {
        err: serializeError,
        error: serializeError,
    },

    redact: {
        paths: [
            "req.headers.authorization",
            "req.headers.cookie",
            'res.headers["set-cookie"]',
        ],
        censor: "[Redacted]",
    },

    transport:
        process.env.NODE_ENV !== "production"
            ? {
                target: "pino-pretty",
                options: {
                    colorize: true,
                    translateTime: "SYS:standard",
                    ignore: "pid,hostname",
                },
            }
            : undefined,

});

export default logger;