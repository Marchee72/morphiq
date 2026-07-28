import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { translate } from '../../i18n';
import { useStore } from '../../presentation/state/store';

interface Props {
  children: React.ReactNode;
  onReset?: () => void;
}

interface State {
  error: Error | null;
}

/**
 * Catches render errors so a crash shows something rather than a blank screen.
 *
 * The app has had no error boundary at all since the classic shell was removed —
 * any thrown render unmounted the whole tree and left white. Class component
 * because `componentDidCatch` has no hook equivalent.
 *
 * Copy goes through the non-hook `translate`: a boundary can catch an error
 * thrown *by* the provider tree, so it cannot rely on context being alive.
 */
export class AtlasErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Render error:', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const lang = useStore.getState().language;

    return (
      <div className="at-pad at-error">
        <div className="at-card at-empty">
          <span className="at-empty-icon" style={{ color: 'var(--clay)' }}>
            <AlertTriangle size={22} />
          </span>
          <h4 className="at-serif">{translate(lang, 'error.title')}</h4>
          <p>{translate(lang, 'error.body')}</p>
          <button
            className="at-btn"
            style={{ justifyContent: 'center' }}
            onClick={() => {
              this.setState({ error: null });
              this.props.onReset?.();
            }}
          >
            {translate(lang, 'error.retry')}
          </button>
        </div>
      </div>
    );
  }
}
