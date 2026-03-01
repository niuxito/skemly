import { createContext, useContext, useState, useCallback } from 'react'
import en from '../locales/en.js'
import es from '../locales/es.js'

const LOCALES = { en, es }
const LS_KEY = 'vibediag_lang'

function detectLang() {
  const stored = localStorage.getItem(LS_KEY)
  if (stored === 'en' || stored === 'es') return stored
  return navigator.language?.slice(0, 2).toLowerCase() === 'es' ? 'es' : 'en'
}

const I18nContext = createContext(null)

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(detectLang)

  const setLang = useCallback((l) => {
    localStorage.setItem(LS_KEY, l)
    setLangState(l)
  }, [])

  const locale = LOCALES[lang] ?? LOCALES.en

  const t = useCallback((key, ...args) => {
    const val = locale[key]
    if (val === undefined) return key
    if (typeof val === 'function') return val(...args)
    return val
  }, [locale])

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  return useContext(I18nContext)
}

export function useT() {
  return useContext(I18nContext).t
}
