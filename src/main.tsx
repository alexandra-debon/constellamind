import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { setupNative } from './native';
import { StoreProvider } from './store';
import './styles.css';

void setupNative();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider fallback={<div className="boot" aria-hidden="true" />}>
      <App />
    </StoreProvider>
  </StrictMode>,
);
