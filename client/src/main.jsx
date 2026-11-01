import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './styles/tokens.css'
import './styles/global.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      {/* Dernier recours : si la mise en page elle-même plante. */}
      <ErrorBoundary standalone>
        <App />
      </ErrorBoundary>
    </BrowserRouter>
  </StrictMode>,
)
