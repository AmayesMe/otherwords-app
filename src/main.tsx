import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { loadDictionary } from './game/dictionary.ts'

// Kick off dictionary load in the background — it will be ready well before
// any player finishes placing their first word.
loadDictionary();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
