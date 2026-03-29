import React from 'react'
import ReactDOM from 'react-dom/client'
import { I18nProvider, useI18n } from '../i18n/I18nProvider'
import { captureCurrentJob, openSidePanelForCurrentTab } from '../lib/chrome/capture'
import '../shared/styles/global.css'
import '../shared/styles/popup.css'

const handleCaptureCurrentJob = async () => {
  await captureCurrentJob()
  await openSidePanelForCurrentTab()
}

function PopupCard() {
  const { locale, setLocale, t } = useI18n()

  return (
    <div className="popup-root">
      <div className="popup-card">
        <div className="popup-topbar">
          <span className="eyebrow">{t.popup.eyebrow}</span>
          <div className="locale-actions">
            <button
              className={`locale-button${locale === 'fr' ? ' active' : ''}`}
              onClick={() => setLocale('fr')}
            >
              {t.common.french}
            </button>
            <button
              className={`locale-button${locale === 'en' ? ' active' : ''}`}
              onClick={() => setLocale('en')}
            >
              {t.common.english}
            </button>
          </div>
        </div>
        <h1>{t.popup.title}</h1>
        <p>{t.popup.description}</p>
        <button className="primary-button" onClick={() => void handleCaptureCurrentJob()}>
          {t.popup.cta}
        </button>
      </div>
    </div>
  )
}

function App() {
  return (
    <I18nProvider>
      <PopupCard />
    </I18nProvider>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
