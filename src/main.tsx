import './style.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import * as run from './sdk/run';
import { appEvents } from './app/appEvents';
import { prefs } from './play/prefs';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('[mishmash] Root element not found');

// Safe-area insets and font scale are only known once the SDK has started.
void run.ready().then(() => {
  const insets = run.safeArea();
  const root = document.documentElement.style;
  root.setProperty('--safe-top', `${insets.top}px`);
  root.setProperty('--safe-bottom', `${insets.bottom}px`);
  root.setProperty('--safe-left', `${insets.left}px`);
  root.setProperty('--safe-right', `${insets.right}px`);
  root.setProperty('--fs', String(run.fontScale()));
});

// Settings (volumes, screen, graphics) before the first game starts.
void prefs.load();

run.onLifecycle({
  pause: () => appEvents.emit('pause'),
  resume: () => appEvents.emit('resume'),
  sleep: () => appEvents.emit('sleep'),
  quit: () => appEvents.emit('quit'),
});

createRoot(rootElement).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
