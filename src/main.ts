import './styles.css'
import { initializeAnalytics, trackAnalyticsEvent } from './analytics'
import { loadAppConfig } from './config'
import { setupIframeAutoResize } from './iframe-resize'
import type { AppConfig, PageOptions, RewardChannel } from './types'
import { parsePageOptions } from './url-options'

/** 获取初始化 HTML 中唯一的应用根节点，喵~ */
function getAppRoot(): HTMLDivElement {
  const root = document.querySelector<HTMLDivElement>('#app')
  if (!root) throw new Error('Missing app root')
  return root
}

const app = getAppRoot()

const analyticsActive = initializeAnalytics()
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

/** 同步运行时标题与基础元信息，便于开发环境和客户端导航读取，喵~ */
function syncRuntimeMetadata(config: AppConfig): void {
  document.title = config.meta.title
  document.querySelector<HTMLMetaElement>('meta[name="description"]')?.setAttribute('content', config.meta.description)
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
function renderProfile(config: AppConfig): HTMLElement | undefined {
  const profile = config.profile
  if (!profile) return undefined
  const section = createElement('header', 'profile')

  if (profile.avatar) {
    const avatar = createElement('img', 'profile__avatar')
    avatar.src = profile.avatar
    avatar.alt = profile.name ? `${profile.name}的头像` : ''
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

/** 渲染单个二维码卡片，并在资源失败时显示配置文案，喵~ */
function renderChannel(channel: RewardChannel, config: AppConfig): HTMLElement {
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
function renderPrivacy(config: AppConfig): HTMLElement {
  const footer = createElement('footer', 'privacy-note')
  const text = createElement('span', undefined, config.ui.privacyNotice)
  const link = createElement('a', 'privacy-note__link', config.ui.privacyLinkLabel)
  link.href = config.ui.privacyPolicyUrl
  link.target = '_blank'
  link.rel = 'noreferrer'
  footer.append(text, document.createTextNode(' '), link)
  return footer
}

/** 按配置与 URL 参数渲染完整赞赏页，喵~ */
function renderPage(config: AppConfig, options: PageOptions): void {
  document.documentElement.dataset.mode = options.mode
  document.body.dataset.mode = options.mode
  app.setAttribute('aria-busy', 'false')
  const main = createElement('main', 'page-shell')

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

  trackAnalyticsEvent('reward_page_view', {
    display_mode: options.mode,
    intro_visible: options.introVisible,
    visible_channels: options.visibleChannelIds.join(','),
  })
}

/** 渲染配置无法使用时的稳定降级页面，喵~ */
function renderFatalError(message: string): void {
  document.documentElement.dataset.mode = 'full'
  document.body.dataset.mode = 'full'
  app.setAttribute('aria-busy', 'false')
  const main = createElement('main', 'page-shell page-shell--error')
  const card = createElement('section', 'fatal-error')
  card.append(createElement('div', 'fatal-error__icon', '!'), createElement('p', 'fatal-error__text', message))
  main.append(card)
  app.replaceChildren(main)
}

/** 加载配置并启动页面，任何异常都不会阻断静态错误态，喵~ */
function start(): void {
  try {
    const config = loadAppConfig()
    syncRuntimeMetadata(config)
    const options = parsePageOptions(window.location.search, config.channels.map((channel) => channel.id))
    try {
      renderPage(config, options)
    } catch {
      trackAnalyticsEvent('reward_config_error', { stage: 'render' })
      renderFatalError(config.ui.configError)
    }
  } catch {
    trackAnalyticsEvent('reward_config_error', { stage: 'parse' })
    renderFatalError('暂时无法加载赞赏信息，请稍后再试。')
  }
}

start()
