// @vitest-environment happy-dom // 使用轻量浏览器环境，喵~

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import publicConfig from '../public/config.json'
import { LOCALE_STORAGE_KEY } from './localization'

/** 重建入口脚本需要的最小静态 HTML，喵~ */
function resetDocument(): void {
  document.documentElement.lang = 'en'
  document.documentElement.removeAttribute('data-mode')
  document.head.innerHTML = `
    <meta name="description" content="Initial description">
    <link rel="canonical" href="https://reward.waynegong.cn/">
    <meta property="og:title" content="Initial title">
    <meta property="og:description" content="Initial description">
    <meta property="og:url" content="https://reward.waynegong.cn/">
    <meta property="og:image" content="https://reward.waynegong.cn/share.png">
    <meta name="twitter:title" content="Initial title">
    <meta name="twitter:description" content="Initial description">
    <meta name="twitter:image" content="https://reward.waynegong.cn/share.png">
    <title>Initial title</title>
  `
  document.body.innerHTML = '<div id="app" aria-busy="true"></div>'
  window.history.replaceState({}, '', '/')
  window.localStorage.clear()
}

beforeEach(() => {
  vi.resetModules()
  resetDocument()
  vi.stubGlobal('__APP_CONFIG__', structuredClone(publicConfig))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('赞赏页多语言入口', () => {
  it('恢复英文选择并在手动切换后同步正文、替代文本、元信息和持久化值', async () => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'en')
    await import('./main')

    expect(document.documentElement.lang).toBe('en')
    expect(document.title).toBe('Wayne’s Appreciation Page')
    expect(document.querySelector('.channels__title')?.textContent).toBe('Choose a way to support')
    expect(document.querySelector<HTMLImageElement>('[data-channel-id="wechat"] img')?.alt)
      .toBe('Wayne’s WeChat reward QR code')
    expect(document.querySelector('meta[property="og:title"]')?.getAttribute('content'))
      .toBe('Wayne’s Appreciation Page')
    expect(document.querySelector('.language-switcher [lang="en"]')?.getAttribute('aria-pressed')).toBe('true')

    document.querySelector<HTMLButtonElement>('[lang="zh-CN"]')?.click()

    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('zh-CN')
    expect(document.documentElement.lang).toBe('zh-CN')
    expect(document.title).toBe('Wayne 的个人赞赏页')
    expect(document.querySelector('.channels__title')?.textContent).toBe('选择赞赏方式')
    expect(document.querySelector<HTMLImageElement>('[data-channel-id="wechat"] img')?.alt)
      .toBe('Wayne 的微信赞赏码')
    expect(document.querySelector('meta[name="twitter:description"]')?.getAttribute('content'))
      .toBe('感谢你的支持，让创作与分享继续发生。')
    expect(document.querySelector('.language-switcher [lang="zh-CN"]')?.getAttribute('aria-pressed')).toBe('true')
  })

  it('在嵌入模式中保留切换器并兼容简介隐藏和渠道筛选', async () => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'zh-CN')
    window.history.replaceState({}, '', '/?mode=embed&intro=0&channels=alipay')
    await import('./main')

    expect(document.body.dataset.mode).toBe('embed')
    expect(document.querySelector('.language-switcher')).not.toBeNull()
    expect(document.querySelector('.profile')).toBeNull()
    expect(document.querySelectorAll('.channel-card')).toHaveLength(1)
    expect(document.querySelector<HTMLElement>('.channel-card')?.dataset.channelId).toBe('alipay')
  })

  it('在空渠道和图片失败场景展示当前语言文案', async () => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'en')
    window.history.replaceState({}, '', '/?channels=')
    await import('./main')
    expect(document.querySelector('.empty-state')?.textContent)
      .toBe('There are no reward options available for this link.')

    vi.resetModules()
    resetDocument()
    vi.stubGlobal('__APP_CONFIG__', structuredClone(publicConfig))
    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'en')
    await import('./main')
    const image = document.querySelector<HTMLImageElement>('[data-channel-id="wechat"] img')
    image?.dispatchEvent(new Event('error'))
    expect(document.querySelector('[data-channel-id="wechat"] .channel-card__image-error')?.textContent)
      .toBe('The QR code is temporarily unavailable')
  })

  it('配置完全损坏时仍按已保存语言显示内置错误文案', async () => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'en')
    vi.stubGlobal('__APP_CONFIG__', {})
    await import('./main')
    expect(document.documentElement.lang).toBe('en')
    expect(document.querySelector('.fatal-error__text')?.textContent)
      .toBe('Reward information is temporarily unavailable. Please try again later.')
  })
})
