import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from './Button';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            gap: 16,
            minHeight: '250px',
            background: 'var(--ui-surface)',
            borderRadius: 'var(--ui-radius-card)',
            margin: 16,
            border: '1px solid var(--ui-outline)',
            color: 'var(--ui-text-primary)',
            fontFamily: 'var(--ui-font)',
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 'var(--ui-radius-pill)',
              background: 'rgba(239, 68, 68, 0.15)',
              color: 'var(--ui-error)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <AlertTriangle size={26} />
          </div>

          <div>
            <h3 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 6px 0' }}>
              {this.props.fallbackTitle || 'Algo no salió bien'}
            </h3>
            <p style={{ fontSize: 13, color: 'var(--ui-text-secondary)', margin: 0, maxWidth: 320, lineHeight: 1.4 }}>
              {this.state.error?.message || 'Ocurrió un error inesperado al cargar esta pantalla.'}
            </p>
          </div>

          <Button
            variant="filled"
            onClick={this.handleReset}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 40, padding: '0 20px' }}
          >
            <RefreshCw size={14} /> Reintentar
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
