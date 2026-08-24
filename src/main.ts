import './styles.css'
import { initializeAnalytics, trackAnalyticsEvent } from './analytics'
import { loadAppConfig, resolveAppConfig } from './config'
import { setupIframeAutoResize } from './iframe-resize'
import { detectLocale, persistLocale } from './localization'
import type { PageOptions, ResolvedAppConfig, RewardChannel, SupportedLocale } from './types'
import { parsePageOptions } from './url-options'

const LOCALE_LABELS: Record<SupportedLocale, string> = {
  'zh-CN': '简体中文',
  en: 'English',
}

const FATAL_ERROR_MESSAGES: Record<SupportedLocale, string> = {
  'zh-CN': '暂时无法加载赞赏信息，请稍后再试。',
  en: 'Reward information is temporarily unavailable. Please try again later.',
}

/** 获取初始化 HTML 中唯一的应用根节点，喵~ */
function getAppRoot(): HTMLDivElement {
  const root = document.querySelector<HTMLDivElement>('#app')
  if (!root) throw new Error('Missing app root')
  return root
}

const app = getAppRoot()
setupIframeAutoResize()

/** 创建带有可选类名和文本的元素，喵~ */
function createElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag)
  if (className) element.className = className
  if (text !== undefined) element.textContent = text
  return element
}

/** 更新指定选择器匹配的元信息内容，喵~ */
function setMetaContent(selector: string, content: string): void {
  document.querySelector<HTMLMetaElement>(selector)?.setAttribute('content', content)
}

/** 同步运行时语言、标题和完整分享元信息，喵~ */
function syncRuntimeMetadata(config: ResolvedAppConfig, locale: SupportedLocale): void {
  const shareImage = new URL(config.meta.shareImage, config.meta.canonicalUrl).toString()
  document.documentElement.lang = locale
  document.title = config.meta.title
  setMetaContent('meta[name="description"]', config.meta.description)
  setMetaContent('meta[property="og:title"]', config.meta.title)
  setMetaContent('meta[property="og:description"]', config.meta.description)
  setMetaContent('meta[property="og:url"]', config.meta.canonicalUrl)
  setMetaContent('meta[property="og:image"]', shareImage)
  setMetaContent('meta[name="twitter:title"]', config.meta.title)
  setMetaContent('meta[name="twitter:description"]', config.meta.description)
  setMetaContent('meta[name="twitter:image"]', shareImage)
  document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.setAttribute('href', config.meta.canonicalUrl)
}

/** 为图片附加完成回调，以便 iframe 高度监听及时响应，喵~ */
function notifyAfterImageSettles(image: HTMLImageElement): void {
  const notify = (): void => {
    window.dispatchEvent(new Event('reward-page:image-settled'))
  }
  image.addEventListener('load', notify, { once: true })
  image.addEventListener('error', notify, { once: true })
}

/** 渲染可选的个人资料与简介区域，喵~ */
function renderProfile(config: ResolvedAppConfig): HTMLElement | undefined {
  const profile = config.profile
  if (!profile) return undefined
  const section = createElement('header', 'profile')

  if (profile.avatar) {
    const avatar = createElement('img', 'profile__avatar')
    avatar.src = profile.avatar
    avatar.alt = profile.avatarAlt ?? ''
    avatar.width = 104
    avatar.height = 104
    avatar.addEventListener('error', () => avatar.remove(), { once: true })
    notifyAfterImageSettles(avatar)
    section.append(avatar)
  }

  if (profile.name) section.append(createElement('h1', 'profile__name', profile.name))
  if (profile.headline) section.append(createElement('p', 'profile__headline', profile.headline))
  if (profile.intro?.length) {
    const intro = createElement('div', 'profile__intro')
    for (const paragraph of profile.intro) intro.append(createElement('p', undefined, paragraph))
    section.append(intro)
  }

  return section.childElementCount ? section : undefined
}

/** 渲染单个二维码卡片，并在资源失败时显示本地化文案，喵~ */
function renderChannel(channel: RewardChannel, config: ResolvedAppConfig): HTMLElement {
  const article = createElement('article', 'channel-card')
  article.dataset.channelId = channel.id
  const heading = createElement('h3', 'channel-card__title', channel.name)
  const imageFrame = createElement('div', 'channel-card__image-frame')
  const image = createElement('img', 'channel-card__image')
  image.src = channel.qrImage
  image.alt = channel.alt
  image.loading = 'eager'
  image.decoding = 'async'
  image.width = 320
  image.height = 320
  image.addEventListener('error', () => {
    imageFrame.classList.add('channel-card__image-frame--error')
    imageFrame.replaceChildren(createElement('p', 'channel-card__image-error', config.ui.imageError))
  }, { once: true })
  notifyAfterImageSettles(image)
  imageFrame.append(image)
  article.append(heading, imageFrame)
  if (channel.description) article.append(createElement('p', 'channel-card__description', channel.description))
  return article
}

/** 渲染 GA 启用时必须展示的精简隐私说明，喵~ */
function renderPrivacy(config: ResolvedAppConfig): HTMLElement {
  const footer = createElement('footer', 'privacy-note')
  const text = createElement('span', undefined, config.ui.privacyNotice)
  const link = createElement('a', 'privacy-note__link', config.ui.privacyLinkLabel)
  link.href = config.ui.privacyPolicyUrl
  link.target = '_blank'
  link.rel = 'noreferrer'
  footer.append(text, document.createTextNode(' '), link)
  return footer
}

/** 渲染双语切换器，并暴露无刷新切换回调，喵~ */
function renderLanguageSwitcher(
  locale: SupportedLocale,
  label: string,
  onLocaleChange: (locale: SupportedLocale) => void,
): HTMLElement {
  const wrapper = createElement('div', 'language-switcher')
  wrapper.setAttribute('role', 'group')
  wrapper.setAttribute('aria-label', label)
  for (const candidate of ['zh-CN', 'en'] as const) {
    const button = createElement('button', 'language-switcher__option', LOCALE_LABELS[candidate])
    button.type = 'button'
    button.lang = candidate
    button.setAttribute('aria-pressed', String(candidate === locale))
    if (candidate === locale) button.classList.add('language-switcher__option--active')
    button.addEventListener('click', () => onLocaleChange(candidate))
    wrapper.append(button)
  }
  return wrapper
}

/** 按配置、语言与 URL 参数渲染完整赞赏页，喵~ */
function renderPage(
  config: ResolvedAppConfig,
  options: PageOptions,
  locale: SupportedLocale,
  analyticsActive: boolean,
  onLocaleChange: (locale: SupportedLocale) => void,
): void {
  document.documentElement.dataset.mode = options.mode
  document.body.dataset.mode = options.mode
  app.setAttribute('aria-busy', 'false')
  const main = createElement('main', 'page-shell')
  main.append(renderLanguageSwitcher(locale, config.ui.languageSwitcherLabel, onLocaleChange))

  if (options.introVisible) {
    const profile = renderProfile(config)
    if (profile) main.append(profile)
  }

  const section = createElement('section', 'channels')
  section.setAttribute('aria-labelledby', 'channels-title')
  const title = createElement('h2', 'channels__title', config.ui.channelsTitle)
  title.id = 'channels-title'
  section.append(title)
  const visibleIdSet = new Set(options.visibleChannelIds)
  const visibleChannels = config.channels.filter((channel) => visibleIdSet.has(channel.id))
  if (visibleChannels.length) {
    const grid = createElement('div', 'channels__grid')
    for (const channel of visibleChannels) grid.append(renderChannel(channel, config))
    section.append(grid)
  } else {
    section.append(createElement('p', 'empty-state', config.ui.noChannels))
  }
  main.append(section)
  if (analyticsActive) main.append(renderPrivacy(config))
  app.replaceChildren(main)
}

/** 渲染配置无法使用时的稳定本地化降级页面，喵~ */
function renderFatalError(message: string, locale: SupportedLocale): void {
  document.documentElement.lang = locale
  document.documentElement.dataset.mode = 'full'
  document.body.dataset.mode = 'full'
  app.setAttribute('aria-busy', 'false')
  const main = createElement('main', 'page-shell page-shell--error')
  const card = createElement('section', 'fatal-error')
  card.append(createElement('div', 'fatal-error__icon', '!'), createElement('p', 'fatal-error__text', message))
  main.append(card)
  app.replaceChildren(main)
}

/** 加载双语配置并启动页面，任何异常都不会阻断静态错误态，喵~ */
function start(): void {
  let currentLocale = detectLocale('zh-CN')
  try {
    const config = loadAppConfig()
    currentLocale = detectLocale(config.defaultLocale)
    const options = parsePageOptions(window.location.search, config.channels.map((channel) => channel.id))
    const initialResolvedConfig = resolveAppConfig(config, currentLocale)
    syncRuntimeMetadata(initialResolvedConfig, currentLocale)
    const analyticsActive = initializeAnalytics()

    const changeLocale = (nextLocale: SupportedLocale): void => {
      if (nextLocale === currentLocale) return
      const previousLocale = currentLocale
      currentLocale = nextLocale
      persistLocale(nextLocale)
      try {
        const resolvedConfig = resolveAppConfig(config, nextLocale)
        syncRuntimeMetadata(resolvedConfig, nextLocale)
        renderPage(resolvedConfig, options, nextLocale, analyticsActive, changeLocale)
        trackAnalyticsEvent('reward_language_change', {
          previous_language: previousLocale,
          content_language: nextLocale,
        })
      } catch {
        trackAnalyticsEvent('reward_config_error', { stage: 'render' })
        renderFatalError(config.locales[nextLocale].ui.configError, nextLocale)
      }
    }

    try {
      renderPage(initialResolvedConfig, options, currentLocale, analyticsActive, changeLocale)
      trackAnalyticsEvent('reward_page_view', {
        display_mode: options.mode,
        intro_visible: options.introVisible,
        visible_channels: options.visibleChannelIds.join(','),
        content_language: currentLocale,
      })
    } catch {
      trackAnalyticsEvent('reward_config_error', { stage: 'render' })
      renderFatalError(initialResolvedConfig.ui.configError, currentLocale)
    }
  } catch {
    const analyticsActive = initializeAnalytics()
    if (analyticsActive) trackAnalyticsEvent('reward_config_error', { stage: 'parse' })
    renderFatalError(FATAL_ERROR_MESSAGES[currentLocale], currentLocale)
  }
}

start()
