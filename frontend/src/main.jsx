import React, { Component, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';

const App = lazy(() => /^\/admin(?:\/|$)/.test(location.pathname) ? import('./admin/Admin.jsx') : import('./storefront/Storefront.jsx'));
class ErrorBoundary extends Component {
  state = { failed:false };
  static getDerivedStateFromError() { return { failed:true }; }
  render() {
    return this.state.failed ? <main style={{padding:40,fontFamily:'sans-serif'}}><h1>We couldn’t load this page.</h1><p>Please refresh to try again.</p><button onClick={() => location.reload()}>Refresh</button></main> : this.props.children;
  }
}
createRoot(document.getElementById('root')).render(<ErrorBoundary><Suspense fallback={null}><App /></Suspense></ErrorBoundary>);
