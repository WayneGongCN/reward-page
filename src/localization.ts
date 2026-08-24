import { SUPPORTED_LOCALES, type SupportedLocale } from './types'

export const LOCALE_STORAGE_KEY = 'reward-page:locale'

interface LocaleStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

interface LocaleDetectionOptions {
  storage?: LocaleStorage | null
  languages?: readonly string[]
}

/** 将浏览器语言标签映射到首期支持的语言，喵~ */
export function matchSupportedLocale(language: string): SupportedLocale | undefined {
  const primaryLanguage = language.trim().toLowerCase().split(/[-_]/, 1)[0]
  if (primaryLanguage === 'zh') return 'zh-CN'
  if (primaryLanguage === 'en') return 'en'
  return undefined
}

/** 判断持久化值是否仍属于当前支持范围，喵~ */
function isSupportedLocale(value: string | null): value is SupportedLocale {
  return value !== null && SUPPORTED_LOCALES.includes(value as SupportedLocale)
}

/** 安全读取浏览器存储，隐私模式异常时视为未保存，喵~ */
function readStoredLocale(storage: LocaleStorage | null): SupportedLocale | undefined {
  try {
    const value = storage?.getItem(LOCALE_STORAGE_KEY) ?? null
    return isSupportedLocale(value) ? value : undefined
  } catch {
    return undefined
  }
}

/** 获取浏览器首选语言列表，兼容仅提供单个 language 的环境，喵~ */
function readBrowserLanguages(): readonly string[] {
  if (typeof navigator === 'undefined') return []
  if (navigator.languages?.length) return navigator.languages
  return navigator.language ? [navigator.language] : []
}

/** 按用户保存值、浏览器偏好和默认语言的优先级选择语言，喵~ */
export function detectLocale(
  defaultLocale: SupportedLocale,
  options: LocaleDetectionOptions = {},
): SupportedLocale {
  let storage: LocaleStorage | null = null
  if ('storage' in options) {
    storage = options.storage ?? null
  } else if (typeof window !== 'undefined') {
    try {
      storage = window.localStorage
    } catch {
      storage = null
    }
  }

  const storedLocale = readStoredLocale(storage)
  if (storedLocale) return storedLocale

  const languages = options.languages ?? readBrowserLanguages()
  for (const language of languages) {
    const locale = matchSupportedLocale(language)
    if (locale) return locale
  }
  return defaultLocale
}

/** 安全保存用户明确选择的语言，存储不可用时静默跳过，喵~ */
export function persistLocale(locale: SupportedLocale, storage?: LocaleStorage | null): void {
  try {
    const targetStorage = storage === undefined && typeof window !== 'undefined' ? window.localStorage : storage
    targetStorage?.setItem(LOCALE_STORAGE_KEY, locale)
  } catch {
    // 存储失败不应阻断语言切换，喵~
  }
}
