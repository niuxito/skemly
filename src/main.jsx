import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { I18nProvider } from './lib/i18n.jsx'
import App from './App.jsx'
import SharedDiagramPage from './components/SharedDiagramPage.jsx'
import AdminPage from './pages/AdminPage.jsx'
import PricingPage from './pages/PricingPage.jsx'
import TermsPage from './pages/TermsPage.jsx'
import PrivacyPage from './pages/PrivacyPage.jsx'
import GalleryPage from './pages/GalleryPage.jsx'

const path = window.location.pathname

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <I18nProvider>
      {path.startsWith('/s/') ? <SharedDiagramPage /> :
       path === '/admin'   ? <AdminPage /> :
       path === '/pricing' ? <PricingPage /> :
       path === '/terms'   ? <TermsPage /> :
       path === '/privacy' ? <PrivacyPage /> :
       path === '/gallery' ? <GalleryPage /> :
       <App />}
    </I18nProvider>
  </StrictMode>,
)
