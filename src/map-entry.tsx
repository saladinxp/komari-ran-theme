import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import MapApp from './MapApp'
import './styles/tokens.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MapApp />
  </StrictMode>,
)
