import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { addAntiCacheHeaders, checkForUpdates } from './utils/cacheBuster';

// Adiciona headers anti-cache
addAntiCacheHeaders();

// Verifica atualizações a cada 30 segundos
setInterval(checkForUpdates, 30000);

// Verifica na inicialização
checkForUpdates();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
