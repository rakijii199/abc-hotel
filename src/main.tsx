import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Pages load as separate chunks. A tab left open across a deploy may request
// chunk files that no longer exist; reload once to pick up the new build.
window.addEventListener('vite:preloadError', (event) => {
  try {
    if (sessionStorage.getItem('abc_chunk_reload') === '1') return;
    sessionStorage.setItem('abc_chunk_reload', '1');
  } catch {
    return;
  }
  event.preventDefault();
  window.location.reload();
});
// Allow another recovery reload later in the session, but never a loop.
window.setTimeout(() => {
  try {
    sessionStorage.removeItem('abc_chunk_reload');
  } catch {
    // Storage unavailable (private mode); nothing to reset.
  }
}, 30000);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
