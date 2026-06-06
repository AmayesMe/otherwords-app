import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { loadDictionary } from './game/dictionary.ts'

// Kick off dictionary load in the background — it will be ready well before
// any player finishes placing their first word.
loadDictionary();

// Dev-only: expose the store on window so preview tests can inspect/mutate state.
if (import.meta.env.DEV) {
  import('./store/gameStore').then(m => { (window as any).__OW_STORE__ = m.useGameStore; });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
