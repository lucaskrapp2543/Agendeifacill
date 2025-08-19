import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { checkForUpdates } from './utils/cacheBuster';

// Configura verificação automática de atualizações
checkForUpdates();

// Adiciona meta tags anti-cache dinamicamente
const addAntiCacheMetaTags = () => {
  const metaTags = [
    { httpEquiv: 'Cache-Control', content: 'no-cache, no-store, must-revalidate, max-age=0' },
    { httpEquiv: 'Pragma', content: 'no-cache' },
    { httpEquiv: 'Expires', content: '0' }
  ];

  metaTags.forEach(tag => {
    if (!document.querySelector(`meta[http-equiv="${tag.httpEquiv}"]`)) {
      const meta = document.createElement('meta');
      meta.setAttribute('http-equiv', tag.httpEquiv);
      meta.setAttribute('content', tag.content);
      document.head.appendChild(meta);
    }
  });
};

// Adiciona meta tags anti-cache
addAntiCacheMetaTags();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
