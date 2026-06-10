import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { LoadingProvider } from './contexts/LoadingContext';
import './legacy/legacy-globals';
import './react-app.css';
import './theme/loading-overlay.css';
import './theme/institutional.css';
import './theme/page-transitions.css';
import './theme/responsive-compact.css';
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <AuthProvider>
        <LoadingProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </LoadingProvider>
      </AuthProvider>
    </HashRouter>
  </React.StrictMode>
);
