import type { PageMode } from './types'

type AnalyticsStorageConsent = 'granted' | 'denied'
type ConfigErrorStage = 'fetch' | 'parse' | 'render'

interface AnalyticsEventMap {
  reward_page_view: {
    display_mode: PageMode
    intro_visible: boolean
    visible_channels: string
  }
  reward_config_error: {
    stage: ConfigErrorStage
  }
}

interface AnalyticsInitializationOptions {
  measurementId?: string
  isProduction?: boolean
  telemetryEnabled?: boolean
}

interface ConsentSettings {
  analytics_storage: AnalyticsStorageConsent
  ad_storage: AnalyticsStorageConsent
  ad_user_data: AnalyticsStorageConsent
  ad_personalization: AnalyticsStorageConsent
}

interface GoogleTagConfig {
  allow_google_signals: boolean
  allow_ad_personalization_signals: boolean
  send_page_view: boolean
}

type AnalyticsParameter = string | number | boolean
type GoogleTagArguments =
  | ['consent', 'default', ConsentSettings]
  | ['js', Date]
  | ['config', string, GoogleTagConfig]
  | ['event', string, Record<string, AnalyticsParameter>]

type GoogleTagFunction = (...args: GoogleTagArguments) => void

interface AnalyticsWindow extends Window {
  dataLayer?: IArguments[]
  gtag?: GoogleTagFunction
  __rewardPageGoogleAnalyticsInitialized__?: boolean
}

const GOOGLE_TAG_SCRIPT_ID = 'reward-page-google-tag'
const MEASUREMENT_ID_PATTERN = /^G-[A-Z0-9]{6,}$/i

/** 获取包含 GA 扩展字段的浏览器窗口，喵~ */
function getAnalyticsWindow(): AnalyticsWindow | undefined {
  if (typeof window === 'undefined') return undefined
  return window as AnalyticsWindow
}

/** 创建与 Google Tag 官方片段一致的异步事件队列函数，喵~ */
function createGoogleTag(analyticsWindow: AnalyticsWindow): GoogleTagFunction {
  return function googleTag(..._args: GoogleTagArguments): void {
    analyticsWindow.dataLayer?.push(arguments)
  }
}

/** 仅在显式开启的生产构建中初始化 GA4，喵~ */
export function initializeAnalytics(options: AnalyticsInitializationOptions = {}): boolean {
  const analyticsWindow = getAnalyticsWindow()
  if (!analyticsWindow || typeof document === 'undefined') return false

  const measurementId = options.measurementId ?? import.meta.env.VITE_GA_MEASUREMENT_ID
  const isProduction = options.isProduction ?? import.meta.env.PROD
  const telemetryEnabled = options.telemetryEnabled ?? import.meta.env.VITE_TELEMETRY_ENABLED === 'true'
  if (!telemetryEnabled || !isProduction || !measurementId || !MEASUREMENT_ID_PATTERN.test(measurementId)) {
    return false
  }
  if (analyticsWindow.__rewardPageGoogleAnalyticsInitialized__) return true

  try {
    analyticsWindow.dataLayer ??= []
    analyticsWindow.gtag ??= createGoogleTag(analyticsWindow)
    analyticsWindow.gtag('consent', 'default', {
      analytics_storage: 'granted',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    })
    analyticsWindow.gtag('js', new Date())
    analyticsWindow.gtag('config', measurementId, {
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      send_page_view: true,
    })

    if (!document.getElementById(GOOGLE_TAG_SCRIPT_ID)) {
      const script = document.createElement('script')
      script.id = GOOGLE_TAG_SCRIPT_ID
      script.async = true
      script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`
      document.head.append(script)
    }
    analyticsWindow.__rewardPageGoogleAnalyticsInitialized__ = true
    return true
  } catch {
    return false
  }
}

/** 发送经过类型约束的匿名产品事件，未启用时静默跳过，喵~ */
export function trackAnalyticsEvent<EventName extends keyof AnalyticsEventMap>(
  eventName: EventName,
  parameters: AnalyticsEventMap[EventName],
): void {
  const analyticsWindow = getAnalyticsWindow()
  if (!analyticsWindow?.__rewardPageGoogleAnalyticsInitialized__ || !analyticsWindow.gtag) return
  analyticsWindow.gtag('event', eventName, parameters)
}
