import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import App from './App';
import './index.css';

import { AuthProvider } from './context/AuthContext';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { SocketProvider } from "./socket/SocketProvider";
import AppErrorBoundary from './components/AppErrorBoundary';


// AppErrorBoundary sits above every provider, so a render exception anywhere --
// including in AuthProvider or SocketProvider, which ChunkErrorBoundary inside
// App cannot see -- lands on a recoverable screen rather than unmounting the
// tree and leaving an empty #root.
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppErrorBoundary>
    <GoogleOAuthProvider
      clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}
    >
      <BrowserRouter>
        <AuthProvider>
          <SocketProvider>
            {/* FavoriteProvider is mounted inside App, alongside CartProvider.
                It used to be mounted here as well, which built a second,
                independent FavoriteContext: every consumer resolves to the
                inner provider, so this outer one held state nobody read while
                still running its own initial GET /favorites. */}
            <App />
          </SocketProvider>
        </AuthProvider>
      </BrowserRouter>
    </GoogleOAuthProvider>
    </AppErrorBoundary>
  </React.StrictMode>
);

// ================= SERVICE WORKER =================

if ("serviceWorker" in navigator) {

  window.addEventListener("load", async () => {

    try {

      const registration =
        await navigator.serviceWorker.register("/sw.js");

      

    } catch (err) {

      console.error(
        "❌ Service Worker Registration Failed",
        err
      );

    }

  });

}