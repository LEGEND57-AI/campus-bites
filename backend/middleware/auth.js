import { getUserFromToken } from "../utils/auth.js";

export const authenticate = async (req, res, next) => {
  try {
    // The previous form -- authorization?.split(' ')[1] -- read only the
    // second space-delimited field and never looked at the scheme in the
    // first, so `Basic <jwt>`, `Token <jwt>`, `Digest <jwt>` and any other
    // word were all accepted, as was trailing content after the token
    // (`Bearer <jwt> extra`). That was not a bypass -- the value still had to
    // be an HS256 JWT signed with JWT_SECRET whose user exists -- but RFC 6750
    // defines exactly one scheme for a bearer token, and a parser that accepts
    // any of them is a permissive input path with nothing to gain from it.
    //
    // Anchored at both ends so the header must be the scheme, separator and a
    // single token and nothing else. The scheme is matched case-insensitively
    // because RFC 7235 defines auth schemes that way; \S+ cannot span the
    // separator, so "exactly one token" is enforced by the trailing $.
    //
    // typeof rather than optional chaining: Node keeps only the first
    // Authorization line when a request repeats it, so this is a string or
    // absent, never an array -- but the check costs nothing and means a
    // non-string can never reach .match().
    const header = req.headers.authorization;

    const match =
      typeof header === "string"
        ? header.match(/^Bearer[ ]+(\S+)$/i)
        : null;

    const token = match?.[1];

    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const user = await getUserFromToken(token);

    req.user = user;

    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};