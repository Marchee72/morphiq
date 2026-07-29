import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Capacitor } from '@capacitor/core'
import './index.css'
import App from './App.tsx'
import { apiBaseUrl } from './data/database/mode'

function sendErrorToServer(level: string, message: string, stack?: string) {
  fetch(`${apiBaseUrl()}/api/logs`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true'
    },
    body: JSON.stringify({
      level,
      message,
      stack: stack || null,
      context: {
        userAgent: navigator.userAgent,
        href: window.location.href,
      }
    })
  }).catch(() => {}); // Suppress failure to log to server to avoid infinite loops
}

// Setup global error listeners
window.addEventListener('error', (e) => {
  const fileInfo = e.filename ? ` at ${e.filename.split('/').pop()}:${e.lineno}` : '';
  const msg = `Error: ${e.message}${fileInfo}`;
  sendErrorToServer('CLIENT_ERROR', msg, e.error?.stack);
});

window.addEventListener('unhandledrejection', (e) => {
  const reason = e.reason instanceof Error ? e.reason.message : String(e.reason);
  const stack = e.reason instanceof Error ? e.reason.stack : undefined;
  sendErrorToServer('CLIENT_UNHANDLED_REJECTION', `Promise Rejection: ${reason}`, stack);
});

const originalConsoleError = console.error;
console.error = (...args) => {
  originalConsoleError.apply(console, args);
  const message = args.map(arg => arg instanceof Error ? arg.message : (typeof arg === 'object' ? JSON.stringify(arg) : String(arg))).join(' ');
  const stack = args.find(arg => arg instanceof Error)?.stack;
  sendErrorToServer('CLIENT_CONSOLE_ERROR', `console.error: ${message}`, stack);
};

// Global mobile keyboard detection
window.addEventListener('focusin', (e) => {
  const target = e.target as HTMLElement | null;
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
    document.body.classList.add('keyboard-open');
  }
});

window.addEventListener('focusout', (e) => {
  const target = e.target as HTMLElement | null;
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
    setTimeout(() => {
      const active = document.activeElement as HTMLElement | null;
      if (!active || (active.tagName !== 'INPUT' && active.tagName !== 'TEXTAREA' && !active.isContentEditable)) {
        document.body.classList.remove('keyboard-open');
      }
    }, 100);
  }
});

if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', () => {
    if (window.visualViewport && window.visualViewport.height < window.innerHeight * 0.75) {
      document.body.classList.add('keyboard-open');
    } else {
      const active = document.activeElement as HTMLElement | null;
      if (!active || (active.tagName !== 'INPUT' && active.tagName !== 'TEXTAREA' && !active.isContentEditable)) {
        document.body.classList.remove('keyboard-open');
      }
    }
  });
}

/**
 * The service worker, which is what makes the web build installable.
 *
 * Not registered inside the Android app: Capacitor serves the same bundle from
 * its own WebView over `http://localhost`, where a second caching layer between
 * the app and its own asset folder buys nothing and can only go wrong.
 *
 * Registered after `load` so it never competes with the first paint for
 * bandwidth on the very visit that decides whether the app feels fast.
 */
if ('serviceWorker' in navigator && !Capacitor.isNativePlatform()) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => {
      // An unregistrable worker costs the offline shell and nothing else, so it
      // is reported rather than surfaced.
      console.warn('Service worker registration failed', err);
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
