import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

// Register the PWA service worker without delaying the application startup.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((error) => {
      console.warn('[ProLink] Service worker registration failed:', error);
    });
  }, { once: true });
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode><App /></React.StrictMode>
);