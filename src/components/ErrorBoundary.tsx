import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div 
          role="alert" 
          aria-live="assertive"
          className="min-h-[350px] w-full flex flex-col items-center justify-center p-6 bg-[#0a0a0a] border border-rose-500/20 rounded-xl text-neutral-200"
        >
          <div className="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-400 mb-4 border border-rose-500/20 shadow-lg shadow-rose-950/40">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-white mb-2 font-mono">
            {this.props.fallbackTitle || 'Ocorreu um erro inesperado'}
          </h2>
          <p className="text-xs text-neutral-400 max-w-md text-center mb-4">
            {this.state.error?.message || 'Falha ao renderizar este módulo. Os dados anteriores foram preservados com segurança.'}
          </p>

          <div className="flex items-center gap-3">
            <button
              onClick={this.handleReset}
              className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-white rounded-lg transition-colors border border-white/10"
              aria-label="Tentar novamente"
            >
              Tentar Novamente
            </button>
            <button
              onClick={this.handleReload}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white rounded-lg transition-colors flex items-center gap-1.5 shadow-md shadow-rose-950/30"
              aria-label="Recarregar aplicação"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Recarregar Página
            </button>
          </div>

          {this.state.errorInfo && (
            <details className="mt-4 text-[11px] text-neutral-500 max-w-lg w-full bg-neutral-900/60 p-3 rounded border border-white/5 overflow-auto">
              <summary className="cursor-pointer hover:text-neutral-300 font-mono mb-1">
                Detalhes técnicos da exceção
              </summary>
              <pre className="text-[10px] text-rose-300/80 overflow-x-auto whitespace-pre-wrap">
                {this.state.error?.stack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
