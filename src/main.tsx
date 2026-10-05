import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ThemeProvider } from './components/ThemeProvider'
// Dev/e2e-only seam; the module gates itself and is empty in a released build.
import './lib/e2eLibrarySeam'
import { restoreUnsaved } from './db/hooks/unsavedRescue'

// Writing a page left owing when the browser page went away — see `unsavedRescue`.
void restoreUnsaved().catch((err) => console.error('Restoring unsaved writing failed', err))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
)
