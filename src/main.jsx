import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { I18nProvider } from './lib/i18n.jsx'
import App from './App.jsx'
import SharedDiagramPage from './components/SharedDiagramPage.jsx'

const isSharedPage = window.location.pathname.startsWith('/s/')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <I18nProvider>
      {isSharedPage ? <SharedDiagramPage /> : <App />}
    </I18nProvider>
  </StrictMode>,
)
