import { isIP } from "node:net";
import logger from "./logger.js";

// ================= CLIENT IP =================
//
// The single place that decides which address a request came from. Used for
// the IP-keyed rate limiters (login, OTP, anything unauthenticated) and for the
// address recorded against a session.
//
// Why not req.ip: production is browser -> Cloudflare -> Render router ->
// Express with `trust proxy` 1, so req.ip is the last X-Forwarded-For entry --
// Render's internal router. The 204 sessions recorded before this helper
// existed held ::1 or 10.x values across only 7 distinct addresses.
// X-Forwarded-For itself is not used: its length varies with the chain, so no
// fixed index identifies the client and an injected entry sits inside it.
//
// Why a header is not trusted blindly: CF-Connecting-IP identifies the client
// only when Cloudflare set it. Cloudflare sets it on every proxied request (and
// the deployment notes record that a caller-supplied one is rejected at the
// edge), but the header proves nothing on a request that did not come through
// that proxy chain -- anyone can send it. So it is honoured only when BOTH:
//
//   1. the deployment names it as the header its trusted edge sets
//      (CLIENT_IP_HEADER, below), and
//   2. the immediate TCP peer is a private / loopback address, i.e. the request
//      reached Express through an internal proxy hop rather than straight from
//      the internet. On Render the app port is only reachable through Render's
//      internal router, whose addresses are private (see above). If the process
//      were ever exposed directly, a spoofed header from a public peer is
//      ignored and the real connection address is used instead.
//
// What this cannot establish from the repository alone (documented, not
// assumed away): that Cloudflare overwrites or rejects a client-supplied
// CF-Connecting-IP for this Render service, and that the service cannot be
// reached through Render's router without passing Cloudflare. Both are
// properties of the Render/Cloudflare edge, not of this code.
//
// CLIENT_IP_HEADER:
//   unset      -> "cf-connecting-ip" when NODE_ENV=production (the documented
//                 Cloudflare -> Render chain), otherwise no header
//   "none"     -> never read a client-IP header; use the connection address
//   <name>     -> read that header (lower-cased) under the peer check above
const configuredHeader = () => {
  const raw = (process.env.CLIENT_IP_HEADER || "").trim().toLowerCase();
  if (raw === "none" || raw === "off" || raw === "false") return null;
  if (raw) return raw;
  return process.env.NODE_ENV === "production" ? "cf-connecting-ip" : null;
};

const stripV4Mapped = (address) =>
  typeof address === "string" && address.toLowerCase().startsWith("::ffff:") && isIP(address.slice(7)) === 4
    ? address.slice(7)
    : address;

// Private, loopback, link-local, CGNAT and unique-local ranges: addresses that
// only an internal hop (a proxy/router inside the deployment) can connect from.
export function isInternalAddress(rawAddress) {
  const address = stripV4Mapped(rawAddress);
  const family = isIP(address || "");

  if (family === 4) {
    const [a, b] = address.split(".").map(Number);
    return (
      a === 10 ||
      a === 127 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254) ||
      (a === 100 && b >= 64 && b <= 127)
    );
  }

  if (family === 6) {
    const lower = address.toLowerCase();
    return (
      lower === "::1" ||
      lower.startsWith("fc") ||
      lower.startsWith("fd") ||
      /^fe[89ab]/.test(lower)
    );
  }

  return false;
}

let warnedUntrustedPeer = false;

// The client address, full precision (callers that bucket it must apply
// express-rate-limit's ipKeyGenerator for IPv6 /56 masking). Falls back to
// req.ip -- the value used before this helper -- whenever the header is not
// configured, missing, repeated, malformed, or arrived from a public peer.
export function getClientIp(req) {
  const headerName = configuredHeader();

  if (headerName) {
    const header = req.headers?.[headerName];

    // A repeated header arrives as an array; only a single string is trusted.
    const candidate = typeof header === "string" ? header.trim() : "";

    // isIP returns 0 for anything that is not one valid IPv4/IPv6 address,
    // which also rejects a comma-separated list.
    if (isIP(candidate) !== 0) {
      const peer = req.socket?.remoteAddress;

      if (isInternalAddress(peer)) {
        return candidate;
      }

      if (!warnedUntrustedPeer) {
        warnedUntrustedPeer = true;
        logger.warn(
          { header: headerName },
          "Client IP header ignored: request did not arrive through an internal proxy hop"
        );
      }
    }
  }

  return req.ip ?? req.socket?.remoteAddress ?? "";
}
