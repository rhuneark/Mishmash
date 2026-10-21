import { Component, type ErrorInfo, type ReactNode } from 'react';
import * as run from '../sdk/run';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/** Last-resort screen if rendering throws. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ErrorBoundary]', error, info.componentStack);
    run.track('ui_error', { message: String(error.message).slice(0, 120) });
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <div className="app">
        <main className="screen">
          <p className="tagline">Something went wrong.</p>
          <button className="btn" onClick={() => window.location.reload()}>
            Try again
          </button>
        </main>
      </div>
    );
  }
}
