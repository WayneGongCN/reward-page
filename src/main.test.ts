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
  ;(window as any).happyDOM.settings.handleDisabledFileLoadingAsSuccess = true
  resetDocument()
  vi.stubGlobal('__APP_CONFIG__', structuredClone(publicConfig))
})

afterEach(() => {
  ;(window as any).happyDOM.settings.handleDisabledFileLoadingAsSuccess = false
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  Reflect.deleteProperty(navigator, 'clipboard')
  Reflect.deleteProperty(document, 'execCommand')
})

/** 构造只用于浏览器测试的虚拟币渠道，不向生产配置写入假收款信息，喵~ */
function createCryptoTestConfig(): any {
  const config: any = structuredClone(publicConfig)
  config.channels.push(
    { id: 'btc', qrImage: '/assets/btc-test.svg', copyValue: 'bc1q-test-address' },
    { id: 'usdt', qrImage: '/assets/usdt-test.svg', copyValue: 'TTestUsdtAddress' },
  )
  config.locales['zh-CN'].channels.btc = {
    name: 'Bitcoin（BTC）',
    alt: 'BTC 测试收款二维码',
    description: '测试渠道，不代表真实收款地址',
  }
  config.locales['zh-CN'].channels.usdt = {
    name: 'Tether（USDT）',
    alt: 'USDT 测试收款二维码',
    description: '测试渠道，不代表真实收款地址',
  }
  config.locales.en.channels.btc = {
    name: 'Bitcoin (BTC)',
    alt: 'BTC test payment QR code',
    description: 'Test channel, not a real payment address',
  }
  config.locales.en.channels.usdt = {
    name: 'Tether (USDT)',
    alt: 'USDT test payment QR code',
    description: 'Test channel, not a real payment address',
  }
  return config
}

describe('赞赏页多语言入口', () => {
  it('恢复英文选择并在手动切换后同步正文、替代文本、元信息和持久化值', async () => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'en')
    await import('./main')

    expect(document.documentElement.lang).toBe('en')
    expect(document.title).toBe('Wayne’s Appreciation Page')
    expect(document.querySelector('.channels__title')?.textContent).toBe('Choose a way to support')
    expect(document.querySelector('.comments__title')?.textContent).toBe('Comments')
    expect(document.querySelectorAll('.comments script[src="https://utteranc.es/client.js"]')).toHaveLength(1)
    expect(document.querySelector<HTMLImageElement>('[data-channel-id="wechat"] img')?.alt)
      .toBe('Wayne’s WeChat reward QR code')
    expect(document.querySelector('[data-channel-id="wechat"] .channel-card__copy')).toBeNull()
    expect(document.querySelector('meta[property="og:title"]')?.getAttribute('content'))
      .toBe('Wayne’s Appreciation Page')
    expect(document.querySelector('.language-switcher [lang="en"]')?.getAttribute('aria-pressed')).toBe('true')

    document.querySelector<HTMLButtonElement>('[lang="zh-CN"]')?.click()

    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('zh-CN')
    expect(document.documentElement.lang).toBe('zh-CN')
    expect(document.title).toBe('Wayne 的个人赞赏页')
    expect(document.querySelector('.channels__title')?.textContent).toBe('选择赞赏方式')
    expect(document.querySelector('.comments__title')?.textContent).toBe('留言')
    expect(document.querySelector('.comments__description')?.textContent)
      .toBe('评论将公开保存到 GitHub Issues，登录 GitHub 后即可参与。')
    expect(document.querySelectorAll('.comments script[src="https://utteranc.es/client.js"]')).toHaveLength(1)
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
    expect(document.querySelector('.comments')).toBeNull()
  })

  it('允许 URL 在两种模式下显式开关评论，并保持固定 Issue 映射', async () => {
    window.history.replaceState({}, '', '/?mode=embed&comments=1')
    await import('./main')

    const script = document.querySelector<HTMLScriptElement>('.comments script')
    expect(script?.getAttribute('repo')).toBe('WayneGongCN/reward-page')
    expect(script?.getAttribute('issue-term')).toBe('pathname')
    expect(script?.getAttribute('label')).toBe('comments')

    vi.resetModules()
    resetDocument()
    vi.stubGlobal('__APP_CONFIG__', structuredClone(publicConfig))
    window.history.replaceState({}, '', '/?comments=0')
    await import('./main')
    expect(document.querySelector('.comments')).toBeNull()
  })

  it('utterances 脚本失败时展示当前语言错误态且保留赞赏渠道', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    ;(window as any).happyDOM.settings.handleDisabledFileLoadingAsSuccess = false
    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'en')
    await import('./main')

    document.querySelector<HTMLScriptElement>('.comments script')?.dispatchEvent(new Event('error'))
    expect(document.querySelector('.comments__status')?.textContent)
      .toBe('Comments are temporarily unavailable. Please try again later.')
    expect(document.querySelectorAll('.channel-card')).toHaveLength(3)
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

  it('按配置顺序筛选 BTC/USDT，并只为带公开文本的渠道渲染复制区域', async () => {
    vi.stubGlobal('__APP_CONFIG__', createCryptoTestConfig())
    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'en')
    window.history.replaceState({}, '', '/?channels=usdt,btc')
    await import('./main')

    const cards = [...document.querySelectorAll<HTMLElement>('.channel-card')]
    expect(cards.map((card) => card.dataset.channelId)).toEqual(['btc', 'usdt'])
    expect(cards[0]?.querySelector('.channel-card__address')?.textContent).toBe('bc1q-test-address')
    expect(cards[0]?.querySelector('.channel-card__copy-button')?.textContent).toBe('Copy address')

    document.querySelector<HTMLButtonElement>('[lang="zh-CN"]')?.click()
    expect(document.querySelector('[data-channel-id="btc"] .channel-card__copy-button')?.textContent).toBe('复制地址')
  })

  it('成功复制完整地址并显示当前语言状态文案', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    vi.stubGlobal('__APP_CONFIG__', createCryptoTestConfig())
    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'zh-CN')
    window.history.replaceState({}, '', '/?channels=btc')
    await import('./main')

    document.querySelector<HTMLButtonElement>('.channel-card__copy-button')?.click()
    await vi.waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('bc1q-test-address')
      expect(document.querySelector('.channel-card__copy-status')?.textContent).toBe('已复制')
    })
    expect(document.querySelector('.channel-card__copy-button')?.textContent).toBe('已复制')
  })

  it('现代剪贴板被拒绝时通过兼容性命令完成复制', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    })
    const execCommand = vi.fn().mockReturnValue(true)
    Object.defineProperty(document, 'execCommand', { configurable: true, value: execCommand })
    vi.stubGlobal('__APP_CONFIG__', createCryptoTestConfig())
    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'zh-CN')
    window.history.replaceState({}, '', '/?channels=usdt')
    await import('./main')

    document.querySelector<HTMLButtonElement>('.channel-card__copy-button')?.click()
    await vi.waitFor(() => {
      expect(execCommand).toHaveBeenCalledWith('copy')
      expect(document.querySelector('.channel-card__copy-status')?.textContent).toBe('已复制')
    })
    expect(document.querySelector('.clipboard-fallback')).toBeNull()
  })

  it('剪贴板与回退复制均失败时保留地址并提示手动复制', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    })
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: vi.fn().mockReturnValue(false),
    })
    vi.stubGlobal('__APP_CONFIG__', createCryptoTestConfig())
    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'en')
    window.history.replaceState({}, '', '/?channels=usdt')
    await import('./main')

    document.querySelector<HTMLButtonElement>('.channel-card__copy-button')?.click()
    await vi.waitFor(() => {
      expect(document.querySelector('.channel-card__copy-status')?.textContent)
        .toBe('Copy failed. Please copy it manually.')
    })
    expect(document.querySelector('.channel-card__address')?.textContent).toBe('TTestUsdtAddress')
  })
})
