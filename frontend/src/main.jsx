import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import App from './App';
import './index.css';

import { AuthProvider } from './context/AuthContext';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { SocketProvider } from "./socket/SocketProvider";


ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
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