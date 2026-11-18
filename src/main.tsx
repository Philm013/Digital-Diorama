import './index.css';

// ?harness=1 renders a biome directly without the UI (used for automated visual checks)
if (new URLSearchParams(location.search).has('harness')) {
  void import('./harness');
} else {
  void Promise.all([import('react-dom/client'), import('./ui/App')]).then(([{ createRoot }, { App }]) => {
    createRoot(document.getElementById('root')!).render(<App />);
  });
}
