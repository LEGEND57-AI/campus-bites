// Loads Razorpay's checkout script on demand.
//
// This used to be a plain <script> tag in index.html, which meant it ran on
// every page load -- including the login page, for visitors who never sign in
// and never pay. checkout.js does not sit idle: on execution it calls
// api.razorpay.com to provision a session, pulls in a risk-detection bundle,
// beacons telemetry, and writes rzp_device_id / rzp_checkout_anon_id /
// rzp_unified_session_id into the browser. None of that has any purpose until
// someone actually starts a payment, so the script is now fetched at that
// moment instead.
//
// Nothing security-sensitive moved: the script is a public CDN asset, the
// Razorpay key id still arrives only from the authenticated
// POST /api/payment/create-order response, and the key secret stays on the
// server. This change is about not loading a tracker for people who are only
// looking at the login form.

const SRC = "https://checkout.razorpay.com/v1/checkout.js";

// Shared across callers so two clicks in the same tick cannot inject two tags.
// Cleared on failure -- see below.
let razorpayPromise;

// Deliberately carries no detail from the underlying load event. The DOM error
// event for a failed script says nothing useful anyway, and the caller shows
// this to the user, so it stays a fixed string. The flag lets the payment
// handler tell a script failure apart from an API failure without parsing text.
function loadError() {
  const error = new Error("Razorpay checkout script failed to load");
  error.isRazorpayLoadError = true;
  return error;
}

export function loadRazorpay() {
  // Already executed -- either from an earlier call in this session or because
  // something else got there first.
  if (typeof window !== "undefined" && window.Razorpay) {
    return Promise.resolve();
  }

  // A load is already in flight; every caller waits on the same one.
  if (razorpayPromise) {
    return razorpayPromise;
  }

  razorpayPromise = new Promise((resolve, reject) => {
    // A tag may already be in the document without window.Razorpay being set
    // yet -- it is still downloading. Attach to it rather than adding a second.
    const existing = document.querySelector(`script[src="${SRC}"]`);

    const script = existing || document.createElement("script");

    const onLoad = () => {
      cleanup();

      // The script fired load but did not define the global. Treated as a
      // failure so the caller never reaches `new window.Razorpay(...)` on an
      // object that is not there.
      if (!window.Razorpay) {
        fail();
        return;
      }

      resolve();
    };

    const onError = () => {
      cleanup();
      fail();
    };

    const cleanup = () => {
      script.removeEventListener("load", onLoad);
      script.removeEventListener("error", onError);
    };

    // On failure the cached promise is dropped and the dead tag removed, so the
    // next attempt starts clean. Without this a single offline moment would
    // leave a permanently rejected promise (and a tag that will never fire
    // load again), and the Pay button could never recover without a reload.
    const fail = () => {
      razorpayPromise = undefined;

      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }

      reject(loadError());
    };

    script.addEventListener("load", onLoad);
    script.addEventListener("error", onError);

    if (!existing) {
      script.src = SRC;
      script.async = true;
      document.body.appendChild(script);
    }
  });

  return razorpayPromise;
}
