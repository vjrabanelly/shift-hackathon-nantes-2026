import React from 'react'
import type { Locale } from './translations'
import { translations } from './translations'

const STORAGE_KEY = 'dreamjob-locale'

type TranslationTree = (typeof translations)[Locale]

interface I18nContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: TranslationTree
}

const detectLocale = (): Locale => {
  const saved = window.localStorage.getItem(STORAGE_KEY)

  if (saved === 'en' || saved === 'fr') {
    return saved
  }

  return navigator.language.toLowerCase().startsWith('fr') ? 'fr' : 'en'
}

const I18nContext = React.createContext<I18nContextValue | null>(null)

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = React.useState<Locale>(() => detectLocale())

  const setLocale = (nextLocale: Locale) => {
    window.localStorage.setItem(STORAGE_KEY, nextLocale)
    setLocaleState(nextLocale)
  }

  const value = React.useMemo(
    () => ({
      locale,
      setLocale,
      t: translations[locale],
    }),
    [locale],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const context = React.useContext(I18nContext)

  if (!context) {
    throw new Error('useI18n must be used inside I18nProvider')
  }

  return context
}
