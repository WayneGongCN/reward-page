// @vitest-environment happy-dom // 使用轻量浏览器环境，喵~

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import publicConfig from '../public/config.json'
import { LOCALE_STORAGE_KEY } from './localization'

const basePaySdkMocks = vi.hoisted(() => ({
  loadCount: 0,
  pay: vi.fn(),
  getPaymentStatus: vi.fn(),
}))

vi.mock('@base-org/account/payment/browser', () => {
  basePaySdkMocks.loadCount += 1
  return {
    pay: basePaySdkMocks.pay,
    getPaymentStatus: basePaySdkMocks.getPaymentStatus,
  }
})

/** 重建入口脚本需要的最小静态 HTML，喵~ */
function resetDocument(): void {
  document.documentElement.lang = 'en'
  document.documentElement.removeAttribute('data-mode')
  document.head.innerHTML = `
    <meta name="description" content="Initial description">
    <link rel="canonical" href="https://reward.waynegong.com/">
    <meta property="og:title" content="Initial title">
    <meta property="og:description" content="Initial description">
    <meta property="og:url" content="https://reward.waynegong.com/">
    <meta property="og:image" content="https://reward.waynegong.com/share.png">
    <meta name="twitter:title" content="Initial title">
    <meta name="twitter:description" content="Initial description">
    <meta name="twitter:image" content="https://reward.waynegong.com/share.png">
    <title>Initial title</title>
  `
  document.body.innerHTML = '<div id="app" aria-busy="true"></div>'
  window.history.replaceState({}, '', '/')
  window.localStorage.clear()
}

beforeEach(() => {
  vi.resetModules()
  basePaySdkMocks.loadCount = 0
  basePaySdkMocks.pay.mockReset()
  basePaySdkMocks.getPaymentStatus.mockReset()
  ;(window as any).happyDOM.settings.handleDisabledFileLoadingAsSuccess = true
  resetDocument()
  vi.stubGlobal('__APP_CONFIG__', structuredClone(publicConfig))
})

afterEach(() => {
  ;(window as any).happyDOM.settings.handleDisabledFileLoadingAsSuccess = false
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
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
    expect(document.querySelector('[role="tablist"]')?.getAttribute('aria-label'))
      .toBe('Switch between support and comments')
    expect(document.querySelector('.top-navigation')?.firstElementChild)
      .toBe(document.querySelector('.page-tabs'))
    expect(document.querySelector('.top-navigation')?.lastElementChild)
      .toBe(document.querySelector('.language-switcher'))
    expect(document.querySelector('[data-page-tab="reward"]')?.getAttribute('aria-selected')).toBe('true')
    expect(document.querySelector('.comments')).toBeNull()
    expect(document.querySelectorAll('script[src="https://utteranc.es/client.js"]')).toHaveLength(0)
    expect(document.querySelector<HTMLImageElement>('[data-channel-id="wechat"] img')?.alt)
      .toBe('Wayne’s WeChat reward QR code')
    expect(document.querySelector('[data-channel-id="wechat"] .channel-card__copy')).toBeNull()
    expect(document.querySelector('[data-channel-id="base"] .channel-card__address')).toBeNull()
    expect(document.querySelector('[data-channel-id="base"] .base-pay__testnet-notice')).not.toBeNull()
    expect(document.querySelector('[data-channel-id="base"] .base-pay__fallback')).toBeNull()
    expect(document.querySelector('[data-channel-id="base"] .base-pay__preset--selected')?.textContent)
      .toBe('3.00 USDC')
    expect(document.querySelector('[data-channel-id="base"] .channel-card__description')?.textContent)
      .toBe('USDC on the Base network only')
    expect(document.querySelector('meta[property="og:title"]')?.getAttribute('content'))
      .toBe('Wayne’s Appreciation Page')
    expect(document.querySelector('.language-switcher [lang="en"]')?.getAttribute('aria-pressed')).toBe('true')

    document.querySelector<HTMLButtonElement>('[lang="zh-CN"]')?.click()

    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('zh-CN')
    expect(document.documentElement.lang).toBe('zh-CN')
    expect(document.title).toBe('Wayne 的个人赞赏页')
    expect(document.querySelector('.channels__title')?.textContent).toBe('选择赞赏方式')
    expect(document.querySelector('[data-page-tab="reward"]')?.textContent).toBe('赞赏')
    expect(document.querySelector('[data-page-tab="comments"]')?.textContent).toBe('留言')
    expect(document.querySelector('.comments')).toBeNull()
    expect(document.querySelector<HTMLImageElement>('[data-channel-id="wechat"] img')?.alt)
      .toBe('Wayne 的微信赞赏码')
    expect(document.querySelector('meta[name="twitter:description"]')?.getAttribute('content'))
      .toBe('感谢你的支持，让创作与分享继续发生。')
    expect(document.querySelector('.language-switcher [lang="zh-CN"]')?.getAttribute('aria-pressed')).toBe('true')
  })

  it('首次切到留言 Tab 时才加载评论，并在语言切换后保留当前 Tab', async () => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'en')
    await import('./main')

    const commentsTab = document.querySelector<HTMLButtonElement>('[data-page-tab="comments"]')!
    commentsTab.click()
    expect(commentsTab.getAttribute('aria-selected')).toBe('true')
    expect(document.querySelector<HTMLElement>('#page-panel-reward')?.hidden).toBe(true)
    expect(document.querySelector<HTMLElement>('#page-panel-comments')?.hidden).toBe(false)
    expect(document.querySelector('.comments__title')?.textContent).toBe('Join the conversation')
    expect(document.querySelectorAll('.comments script[src="https://utteranc.es/client.js"]')).toHaveLength(1)

    document.querySelector<HTMLButtonElement>('[lang="zh-CN"]')?.click()
    expect(document.querySelector('[data-page-tab="comments"]')?.getAttribute('aria-selected')).toBe('true')
    expect(document.querySelector<HTMLElement>('#page-panel-reward')?.hidden).toBe(true)
    expect(document.querySelector('.comments__title')?.textContent).toBe('交流与留言')
    expect(document.querySelector('.comments__description')?.textContent)
      .toBe('评论将公开保存到 GitHub Issues，登录 GitHub 后即可参与。')
    expect(document.querySelectorAll('.comments script[src="https://utteranc.es/client.js"]')).toHaveLength(1)
  })

  it('Tab 支持左右方向键切换并同步焦点与面板状态', async () => {
    await import('./main')
    const rewardTab = document.querySelector<HTMLButtonElement>('[data-page-tab="reward"]')!
    const commentsTab = document.querySelector<HTMLButtonElement>('[data-page-tab="comments"]')!

    rewardTab.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    expect(commentsTab.getAttribute('aria-selected')).toBe('true')
    expect(document.activeElement).toBe(commentsTab)

    commentsTab.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }))
    expect(rewardTab.getAttribute('aria-selected')).toBe('true')
    expect(document.activeElement).toBe(rewardTab)
    expect(document.querySelector<HTMLElement>('#page-panel-reward')?.hidden).toBe(false)
    expect(document.querySelector<HTMLElement>('#page-panel-comments')?.hidden).toBe(true)
  })

  it('在嵌入模式中保留切换器并兼容简介隐藏和渠道筛选', async () => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'zh-CN')
    window.history.replaceState({}, '', '/?mode=embed&intro=0&channels=alipay')
    await import('./main')

    expect(document.body.dataset.mode).toBe('embed')
    expect(document.querySelector('.language-switcher')).not.toBeNull()
    expect(document.querySelector('.top-navigation')?.classList.contains('top-navigation--language-only')).toBe(true)
    expect(document.querySelector('.top-navigation')?.children).toHaveLength(1)
    expect(document.querySelector('.profile')).toBeNull()
    expect(document.querySelectorAll('.channel-card')).toHaveLength(1)
    expect(document.querySelector<HTMLElement>('.channel-card')?.dataset.channelId).toBe('alipay')
    expect(document.querySelector('.comments')).toBeNull()
  })

  it('允许 URL 在两种模式下显式开关评论，并保持固定 Issue 映射', async () => {
    window.history.replaceState({}, '', '/?mode=embed&comments=1')
    await import('./main')

    expect(document.querySelector('.page-tabs')).not.toBeNull()
    expect(document.querySelector('.comments')).toBeNull()
    document.querySelector<HTMLButtonElement>('[data-page-tab="comments"]')?.click()
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
    expect(document.querySelector('.page-tabs')).toBeNull()
  })

  it('utterances 脚本失败时展示当前语言错误态且保留赞赏渠道', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    ;(window as any).happyDOM.settings.handleDisabledFileLoadingAsSuccess = false
    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'en')
    await import('./main')

    document.querySelector<HTMLButtonElement>('[data-page-tab="comments"]')?.click()
    expect(document.querySelector('.comments__status')?.textContent)
      .toBe('Comments are temporarily unavailable. Please try again later.')
    expect(document.querySelectorAll('.channel-card')).toHaveLength(publicConfig.channels.length)
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

  it('在测试网完成预设和自定义金额支付，并在语言切换后恢复成功状态', async () => {
    basePaySdkMocks.pay.mockResolvedValue({ id: 'payment-success' })
    basePaySdkMocks.getPaymentStatus.mockResolvedValue({ status: 'completed' })
    let observerCallback: IntersectionObserverCallback | undefined
    let observerInstance: IntersectionObserver | undefined
    class TestIntersectionObserver {
      constructor(callback: IntersectionObserverCallback) {
        observerCallback = callback
        observerInstance = this as unknown as IntersectionObserver
      }

      observe(): void {}
      disconnect(): void {}
      unobserve(): void {}
      takeRecords(): IntersectionObserverEntry[] { return [] }
      readonly root = null
      readonly rootMargin = '300px'
      readonly thresholds = [0]
    }
    vi.stubGlobal('IntersectionObserver', TestIntersectionObserver)
    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'en')
    await import('./main')

    const payButton = document.querySelector<HTMLButtonElement>('.base-pay__button')!
    expect(payButton.disabled).toBe(true)
    observerCallback?.([{ isIntersecting: true } as IntersectionObserverEntry], observerInstance!)
    await vi.waitFor(() => expect(payButton.disabled).toBe(false))
    document.querySelector<HTMLButtonElement>('[data-base-pay-amount="5.00"]')?.click()
    expect(document.querySelector('.base-pay__preset--selected')?.textContent).toBe('5.00 USDC')

    const customInput = document.querySelector<HTMLInputElement>('.base-pay__custom-input')!
    customInput.value = '2.999'
    customInput.dispatchEvent(new Event('input', { bubbles: true }))
    expect(payButton.disabled).toBe(true)
    expect(customInput.getAttribute('aria-invalid')).toBe('true')

    customInput.value = '2.50'
    customInput.dispatchEvent(new Event('input', { bubbles: true }))
    expect(payButton.disabled).toBe(false)
    expect(document.querySelector('.base-pay__preset--selected')).toBeNull()
    payButton.click()

    await vi.waitFor(() => {
      expect(basePaySdkMocks.pay).toHaveBeenCalledWith({
        amount: '2.50',
        to: '0xEF787423A25713C0c979d4F5323FB05b2C2b5D38',
        testnet: true,
        telemetry: false,
      })
      expect(document.querySelector('.base-pay__status')?.textContent)
        .toBe('Thank you for your USDC support. The payment is confirmed.')
    })
    expect(basePaySdkMocks.getPaymentStatus).toHaveBeenCalledWith({
      id: 'payment-success',
      expectedPayment: {
        amount: '2.50',
        recipient: '0xEF787423A25713C0c979d4F5323FB05b2C2b5D38',
      },
      testnet: true,
      telemetry: false,
    })

    document.querySelector<HTMLButtonElement>('[lang="zh-CN"]')?.click()
    expect(document.querySelector<HTMLInputElement>('.base-pay__custom-input')?.value).toBe('2.50')
    expect(document.querySelector('.base-pay__status')?.textContent)
      .toBe('感谢你的 USDC 赞赏，付款已确认。')
  })

  it('主网默认折叠备用钱包，并在展开时才渲染二维码与复制地址', async () => {
    vi.stubEnv('VITE_BASE_PAY_NETWORK', 'base')
    await import('./main')

    const card = document.querySelector<HTMLElement>('[data-channel-id="base"]')!
    const details = card.querySelector<HTMLDetailsElement>('.base-pay__fallback')!
    expect(card.querySelector('.base-pay__testnet-notice')).toBeNull()
    expect(details.open).toBe(false)
    expect(details.querySelector('.channel-card__address')).toBeNull()
    expect(details.querySelector('img')).toBeNull()

    details.open = true
    details.dispatchEvent(new Event('toggle'))
    expect(details.querySelector('.channel-card__address')?.textContent)
      .toBe('0xEF787423A25713C0c979d4F5323FB05b2C2b5D38')
    expect(details.querySelector<HTMLImageElement>('img')?.src).toContain('/assets/base-reward-code.png')
  })

  it('URL 过滤 Base 渠道时完全不加载 Base Pay SDK', async () => {
    window.history.replaceState({}, '', '/?channels=wechat')
    await import('./main')
    await Promise.resolve()

    expect(document.querySelector('[data-channel-id="base"]')).toBeNull()
    expect(basePaySdkMocks.loadCount).toBe(0)
  })

  it('SDK 加载失败时自动展开主网备用钱包且不影响其他页面能力', async () => {
    vi.stubEnv('VITE_BASE_PAY_NETWORK', 'base')
    vi.stubGlobal('IntersectionObserver', undefined)
    vi.doMock('@base-org/account/payment/browser', () => {
      throw new Error('SDK load failed')
    })
    await import('./main')

    await vi.waitFor(() => {
      const fallback = document.querySelector<HTMLDetailsElement>('[data-channel-id="base"] .base-pay__fallback')
      expect(fallback?.open).toBe(true)
      expect(fallback?.querySelector('.channel-card__address')?.textContent)
        .toBe('0xEF787423A25713C0c979d4F5323FB05b2C2b5D38')
    })
    expect(document.querySelector('[data-channel-id="wechat"]')).not.toBeNull()
    document.querySelector<HTMLButtonElement>('[data-page-tab="comments"]')?.click()
    expect(document.querySelector('.comments')).not.toBeNull()
  })
})
