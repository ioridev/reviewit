import React from 'react';
import ReactDOM from 'react-dom/client';

import App from './App';
import './styles/global.css';

console.log('[main.tsx] Starting ReviewIt app...');
console.log('[main.tsx] Environment:', { VSCODE: import.meta.env.VSCODE });

const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error('[main.tsx] Root element not found!');
} else {
  console.log('[main.tsx] Root element found, rendering app...');
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
