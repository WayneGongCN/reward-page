import { afterEach, describe, expect, it, vi } from 'vitest'
import { initializeAnalytics, trackAnalyticsEvent } from './analytics'

interface FakeScript {
  id?: string
  async?: boolean
  src?: string
}

interface FakeAnalyticsWindow {
  dataLayer?: IArguments[]
  gtag?: (...args: unknown[]) => void
  __rewardPageGoogleAnalyticsInitialized__?: boolean
}

/** 安装最小浏览器替身以验证 GA 队列与脚本加载，喵~ */
function installBrowser(): { analyticsWindow: FakeAnalyticsWindow; scripts: FakeScript[] } {
  const analyticsWindow: FakeAnalyticsWindow = {}
  const scripts: FakeScript[] = []
  const documentStub = {
    head: { append: (script: FakeScript) => scripts.push(script) },
    createElement: () => ({} as FakeScript),
    getElementById: (id: string) => scripts.find((script) => script.id === id) ?? null,
  }
  vi.stubGlobal('window', analyticsWindow)
  vi.stubGlobal('document', documentStub)
  return { analyticsWindow, scripts }
}

/** 将 gtag 标准 arguments 队列转换成便于断言的数组，喵~ */
function readDataLayer(analyticsWindow: FakeAnalyticsWindow): unknown[][] {
  return (analyticsWindow.dataLayer ?? []).map((entry) => Array.from(entry))
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('initializeAnalytics', () => {
  it('仅在生产环境、总开关开启且 ID 合法时加载', () => {
    const { analyticsWindow, scripts } = installBrowser()
    expect(initializeAnalytics({
      measurementId: 'G-ABC12345',
      isProduction: true,
      telemetryEnabled: true,
    })).toBe(true)
    expect(scripts).toEqual([{
      id: 'reward-page-google-tag',
      async: true,
      src: 'https://www.googletagmanager.com/gtag/js?id=G-ABC12345',
    }])
    const queue = readDataLayer(analyticsWindow)
    expect(queue[0]).toEqual(['consent', 'default', {
      analytics_storage: 'granted',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    }])
    expect(queue[2]).toEqual(['config', 'G-ABC12345', {
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      send_page_view: true,
    }])
  })

  it.each([
    ['遥测关闭', { measurementId: 'G-ABC12345', isProduction: true, telemetryEnabled: false }],
    ['非生产构建', { measurementId: 'G-ABC12345', isProduction: false, telemetryEnabled: true }],
    ['缺少 ID', { measurementId: undefined, isProduction: true, telemetryEnabled: true }],
    ['非法 ID', { measurementId: 'UA-12345', isProduction: true, telemetryEnabled: true }],
  ])('%s 时不加载', (_name, options) => {
    const { scripts } = installBrowser()
    expect(initializeAnalytics(options)).toBe(false)
    expect(scripts).toEqual([])
  })

  it('重复初始化保持幂等', () => {
    const { scripts } = installBrowser()
    const options = { measurementId: 'G-ABC12345', isProduction: true, telemetryEnabled: true }
    expect(initializeAnalytics(options)).toBe(true)
    expect(initializeAnalytics(options)).toBe(true)
    expect(scripts).toHaveLength(1)
  })
})

describe('trackAnalyticsEvent', () => {
  it('初始化后发送类型化事件', () => {
    const { analyticsWindow } = installBrowser()
    initializeAnalytics({ measurementId: 'G-ABC12345', isProduction: true, telemetryEnabled: true })
    trackAnalyticsEvent('reward_page_view', {
      display_mode: 'embed',
      intro_visible: false,
      visible_channels: 'wechat,alipay',
    })
    expect(readDataLayer(analyticsWindow).at(-1)).toEqual(['event', 'reward_page_view', {
      display_mode: 'embed',
      intro_visible: false,
      visible_channels: 'wechat,alipay',
    }])
  })

  it('未初始化时静默忽略事件', () => {
    const { analyticsWindow } = installBrowser()
    expect(() => trackAnalyticsEvent('reward_config_error', { stage: 'fetch' })).not.toThrow()
    expect(readDataLayer(analyticsWindow)).toEqual([])
  })
})
