import React from 'react';
import { RefreshCw, LifeBuoy } from 'lucide-react';

/**
 * Filet de sécurité : une erreur dans une vue n'affiche plus un écran noir,
 * elle propose de réessayer sans perdre le reste de l'application.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Erreur d’interface :', error, info?.componentStack);
  }

  componentDidUpdate(prevProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="h-full flex items-center justify-center">
        <div className="max-w-md text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto">
            <LifeBuoy className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-zinc-50">Cette page a rencontré un problème</h2>
            <p className="text-sm text-zinc-400 mt-1.5">
              Rien n'est perdu : vos projets et vos serveurs sont intacts. Vous pouvez réessayer ou changer de page.
            </p>
          </div>
          <button type="button" className="btn theme-accent-btn" onClick={() => this.setState({ error: null })}>
            <RefreshCw className="w-4 h-4" />
            Réessayer
          </button>
          <p className="text-[11px] font-mono text-zinc-600 break-words">{String(this.state.error?.message || '')}</p>
        </div>
      </div>
    );
  }
}
