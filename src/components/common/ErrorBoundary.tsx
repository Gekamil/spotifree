import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  private recoveryTimer: any = null;

  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[Spotifree ErrorBoundary Caught]', error, errorInfo);
    // Auto-recover so transient skips/rendering errors self-heal without freezing the app on black screen
    if (this.recoveryTimer) clearTimeout(this.recoveryTimer);
    this.recoveryTimer = setTimeout(() => {
      this.setState({ hasError: false, error: null });
    }, 1800);
  }

  public componentWillUnmount() {
    if (this.recoveryTimer) clearTimeout(this.recoveryTimer);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-[999999] min-h-[100dvh] w-full flex flex-col items-center justify-center p-6 text-center bg-[#121212] text-white select-none font-['SpotifyMixUI']">
          <div className="w-14 h-14 rounded-full bg-[#1ed760] text-black flex items-center justify-center shadow-lg mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold font-['SpotifyMixUITitle'] mb-1">
            {this.props.fallbackTitle || 'Algo no ha salido como esperábamos'}
          </h2>
          <p className="text-xs text-[#b3b3b3] max-w-xs mb-5">
            Hemos protegido la reproducción para que no se detenga. Restaurando en breve...
          </p>
          <button
            onClick={() => {
              if (this.recoveryTimer) clearTimeout(this.recoveryTimer);
              this.setState({ hasError: false, error: null });
            }}
            className="px-6 py-2.5 rounded-full bg-white text-black font-bold text-xs uppercase tracking-wider hover:scale-105 active:scale-95 transition-all shadow-md cursor-pointer"
          >
            Reintentar ahora
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
