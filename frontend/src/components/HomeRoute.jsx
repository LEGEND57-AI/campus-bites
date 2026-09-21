import { lazy, Suspense, useLayoutEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import FullScreenLoader from "./FullScreenLoader";
import Dashboard from "../pages/Dashboard";
import { hasCachedUser, registerPublicSurface } from "../utils/appEntry";

// The landing page stays its own chunk: signed-in users never download it.
// The import is shared, so it can be started early (below) and React.lazy
// reuses the request already in flight instead of starting a second one.
let landingRequest = null;
const loadLanding = () => {
  if (!landingRequest) {
    landingRequest = import("../pages/LandingPage").catch((error) => {
      // Let a later render retry (ChunkErrorBoundary handles the failure).
      landingRequest = null;
      throw error;
    });
  }
  return landingRequest;
};
const LandingPage = lazy(loadLanding);

// A tab opened on "/" with no saved session is going to show the landing
// page, so fetch its chunk now -- in parallel with React's first render and
// the auth check -- rather than when HomeRoute first renders it.
if (
  typeof window !== "undefined" &&
  window.location.pathname === "/" &&
  !hasCachedUser()
) {
  loadLanding();
}

// Shown only while the landing chunk downloads. Deliberately not a loader:
// no spinner, no branding, and it does not register as a full-screen loading
// state, so it can never start or prolong the branded entry presentation.
// It is the landing page's own background colour, so the page paints in
// place over it without a colour jump.
const LandingSurface = () => (
  <div aria-hidden="true" style={{ minHeight: "100vh", background: "#F6FAFF" }} />
);

/**
 * The public landing page. Registers as a public surface for as long as it is
 * mounted -- including while its chunk is still downloading -- so the branded
 * entry loader never covers it (see utils/appEntry.js).
 */
function PublicLanding() {
  useLayoutEffect(() => registerPublicSurface(), []);
  return (
    <Suspense fallback={<LandingSurface />}>
      <LandingPage />
    </Suspense>
  );
}

/**
 * Decides what "/" shows.
 *
 * Signed-in behaviour is exactly what ProtectedRoute did for "/" before the
 * landing page existed -- students get the Dashboard, admins are sent to
 * /admin. Signed-out visitors get the public landing page, whose
 * "Get Started" links to /login.
 *
 * ProtectedRoute itself is untouched and still guards every other student
 * route.
 */
const HomeRoute = () => {
  const { user, loading } = useAuth();

  if (loading) {
    // With no saved session AuthContext has nothing to restore and will
    // settle as signed out without any request (hasCachedUser mirrors its
    // check), so show the landing page now instead of a loading frame.
    if (!hasCachedUser()) {
      return <PublicLanding />;
    }
    // A saved session is being restored -- deciding now would flash the
    // landing page at a user who is actually signed in.
    return <FullScreenLoader />;
  }

  if (!user) {
    return <PublicLanding />;
  }

  if (user.role === "admin") {
    return <Navigate to="/admin" replace />;
  }

  return <Dashboard />;
};

export default HomeRoute;
