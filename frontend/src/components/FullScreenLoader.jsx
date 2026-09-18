import { useEffect } from "react";
import BrandLoader from "./BrandLoader";
import { registerFullScreenLoader, useEntryPresenting } from "../utils/appEntry";

// The app's full-screen loading slot (session restore in ProtectedRoute /
// AdminRoute, lazy route chunks in App.jsx). During an app-entry event the
// branded loader is already presented above the app (AppEntryLoader), so the
// slot only holds a plain surface underneath it; otherwise — an ordinary
// refresh or route change — it shows the quiet spinner the app used before.
// See utils/appEntry.js.
export default function FullScreenLoader() {
  const presenting = useEntryPresenting();

  useEffect(() => registerFullScreenLoader(), []);

  if (presenting) {
    return <div className="min-h-screen bg-white" aria-hidden="true" />;
  }

  return (
    <div className="min-h-screen bg-[#F3F6FB] flex items-center justify-center">
      <div
        className="
          w-12
          h-12
          rounded-full
          border-4
          border-blue-200
          border-t-blue-600
          animate-spin
        "
      />
    </div>
  );
}

// The single branded loader for an app-entry event (first open, or a return
// after meaningful inactivity), presented above whatever the app renders —
// Login for signed-out visitors, the app for signed-in users. It stays until
// the entry has been shown and initial loading is done (utils/appEntry.js).
export function AppEntryLoader() {
  return useEntryPresenting() ? <BrandLoader /> : null;
}
