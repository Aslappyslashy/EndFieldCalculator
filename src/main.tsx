import { StrictMode, Component, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

try {
  const testKey = '__storage_test__';
  localStorage.setItem(testKey, testKey);
  localStorage.removeItem(testKey);
} catch (e) {
  console.warn('localStorage unavailable, clearing...');
  try {
    localStorage.removeItem('endfield_scenarios');
    localStorage.removeItem('endfield_active_scenario');
  } catch {}
}

const root = document.getElementById('root')!;

function ErrorFallback() {
  return (
    <div style={{ padding: '20px', color: '#fff', background: '#1a1c1e', minHeight: '100vh' }}>
      <h1>Application Error</h1>
      <p>There was an error loading the application.</p>
      <button
        onClick={() => {
          localStorage.clear();
          window.location.reload();
        }}
        style={{ padding: '10px 20px', marginTop: '20px', cursor: 'pointer' }}
      >
        Clear Data & Reload
      </button>
    </div>
  );
}

class RootErrorBoundary extends Component<{ children: ReactNode }> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: Error) {
    console.error('Root error:', error);
  }
  render() {
    if (this.state.hasError) {
      return <ErrorFallback />;
    }
    return this.props.children;
  }
}

createRoot(root).render(
  <StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </StrictMode>,
)
