import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './ui/tokens.css'
import './ui/ui.css'
import App from './App.tsx'
const API_URL = (import.meta.env?.VITE_API_URL as string) || 'http://localhost:3000';

function sendErrorToServer(level: string, message: string, stack?: string) {
  fetch(`${API_URL}/api/logs`, {
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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
