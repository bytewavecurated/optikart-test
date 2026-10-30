import React from 'react';

// Keeps one broken page from blanking the entire application. Without this an
// uncaught render error unmounts the React root and the user sees an empty tab.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: (error && error.message) || 'Unexpected error' };
  }

  componentDidCatch(error, info) {
    console.error('Unhandled UI error:', error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div className="card" style={{ maxWidth: 520, padding: 40, textAlign: 'center' }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 12 }}>Something went wrong</h1>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 8 }}>
            This section could not be displayed. Your cart and account are unaffected.
          </p>
          {this.state.message && (
            <p style={{ fontSize: 12, color: 'var(--text-light)', marginBottom: 20, wordBreak: 'break-word' }}>
              {this.state.message}
            </p>
          )}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button className="btn btn-primary" onClick={() => this.setState({ hasError: false, message: '' })}>
              Try again
            </button>
            <a className="btn btn-outline" href="/">Back to Home</a>
          </div>
        </div>
      </div>
    );
  }
}
