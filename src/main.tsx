import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { registerPdfFonts } from './fonts.ts'

registerPdfFonts(`${import.meta.env.BASE_URL}fonts/`)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
