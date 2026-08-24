import {
  SUPPORTED_LOCALES,
  type AppConfig,
  type CommentsConfig,
  type LocalizedPageContent,
  type LocalizedProfileConfig,
  type LocalizedRewardChannel,
  type ResolvedAppConfig,
  type SharedProfileConfig,
  type SharedRewardChannel,
  type SharedSiteMeta,
  type SupportedLocale,
  type UiConfig,
} from './types'

export class ConfigValidationError extends Error {
  readonly code: string

  constructor(code: string) {
    super(`Invalid reward page config: ${code}`)
    this.name = 'ConfigValidationError'
    this.code = code
  }
}

/** 判断未知值是否为可安全读取的普通对象，喵~ */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** 读取非空字符串字段，字段不合法时返回空值，喵~ */
function readRequiredString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key]
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined
}

/** 读取可选非空字符串字段，喵~ */
function readOptionalString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key]
  if (value === undefined) return undefined
  return typeof value === 'string' ? value.trim() || undefined : undefined
}

/** 校验静态资源只能使用项目内的同源绝对或相对路径，喵~ */
export function isSafeAssetPath(value: string): boolean {
  if (value.includes('\\') || value.includes('\0') || value.includes('..')) return false
  return (value.startsWith('/') && !value.startsWith('//')) || value.startsWith('./')
}

/** 校验公开网页地址只能使用 HTTP 或 HTTPS 协议，喵~ */
function isPublicWebUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

/** 校验语言值属于首期固定支持范围，喵~ */
function parseLocale(value: unknown, code: string): SupportedLocale {
  if (typeof value !== 'string' || !SUPPORTED_LOCALES.includes(value as SupportedLocale)) {
    throw new ConfigValidationError(code)
  }
  return value as SupportedLocale
}

/** 校验共享站点元信息配置，喵~ */
function parseSharedMeta(value: unknown): SharedSiteMeta {
  if (!isRecord(value)) throw new ConfigValidationError('meta')
  const canonicalUrl = readRequiredString(value, 'canonicalUrl')
  const shareImage = readRequiredString(value, 'shareImage')
  if (!canonicalUrl || !shareImage) throw new ConfigValidationError('meta.fields')
  if (!isPublicWebUrl(canonicalUrl)) throw new ConfigValidationError('meta.canonicalUrl')
  if (!isSafeAssetPath(shareImage)) throw new ConfigValidationError('meta.shareImage')
  return { canonicalUrl, shareImage }
}

/** 校验可选共享个人资料配置，喵~ */
function parseSharedProfile(value: unknown): SharedProfileConfig | undefined {
  if (value === undefined) return undefined
  if (!isRecord(value)) throw new ConfigValidationError('profile')
  const avatar = readOptionalString(value, 'avatar')
  if (value.avatar !== undefined && typeof value.avatar !== 'string') throw new ConfigValidationError('profile.avatar')
  if (avatar && !isSafeAssetPath(avatar)) throw new ConfigValidationError('profile.avatar')
  return { avatar }
}

/** 校验 utterances 使用的公开 GitHub 仓库与评论标签，喵~ */
function parseComments(value: unknown): CommentsConfig {
  if (!isRecord(value)) throw new ConfigValidationError('comments')
  const repository = readRequiredString(value, 'repository')
  const label = readRequiredString(value, 'label')
  if (!repository || !label) throw new ConfigValidationError('comments.fields')
  if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/[A-Za-z0-9._-]{1,100}$/.test(repository)) {
    throw new ConfigValidationError('comments.repository')
  }
  return { repository, label }
}

/** 校验共享赞赏渠道，喵~ */
function parseSharedChannel(value: unknown, index: number): SharedRewardChannel {
  if (!isRecord(value)) throw new ConfigValidationError(`channels.${index}`)
  const id = readRequiredString(value, 'id')
  const qrImage = readRequiredString(value, 'qrImage')
  const copyValue = readOptionalString(value, 'copyValue')
  if (!id || !qrImage) throw new ConfigValidationError(`channels.${index}.fields`)
  if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) throw new ConfigValidationError(`channels.${index}.id`)
  if (!isSafeAssetPath(qrImage)) throw new ConfigValidationError(`channels.${index}.qrImage`)
  if (value.copyValue !== undefined && !copyValue) {
    throw new ConfigValidationError(`channels.${index}.copyValue`)
  }
  return copyValue ? { id, qrImage, copyValue } : { id, qrImage }
}

/** 校验本地化个人资料文案，喵~ */
function parseLocalizedProfile(value: unknown, locale: SupportedLocale): LocalizedProfileConfig | undefined {
  if (value === undefined) return undefined
  if (!isRecord(value)) throw new ConfigValidationError(`locales.${locale}.profile`)
  const optionalKeys = ['name', 'headline', 'avatarAlt'] as const
  const result = Object.fromEntries(optionalKeys.map((key) => [key, readOptionalString(value, key)]))
  for (const key of optionalKeys) {
    if (value[key] !== undefined && typeof value[key] !== 'string') {
      throw new ConfigValidationError(`locales.${locale}.profile.${key}`)
    }
  }

  let intro: string[] | undefined
  if (value.intro !== undefined) {
    if (!Array.isArray(value.intro) || !value.intro.every((item) => typeof item === 'string' && item.trim())) {
      throw new ConfigValidationError(`locales.${locale}.profile.intro`)
    }
    intro = value.intro.map((item) => item.trim())
  }
  return { ...result, intro } as LocalizedProfileConfig
}

/** 校验本地化界面文案与隐私地址，喵~ */
function parseUi(value: unknown, locale: SupportedLocale): UiConfig {
  if (!isRecord(value)) throw new ConfigValidationError(`locales.${locale}.ui`)
  const keys = [
    'channelsTitle',
    'configError',
    'noChannels',
    'imageError',
    'addressLabel',
    'copyAddress',
    'copySuccess',
    'copyFailure',
    'commentsTitle',
    'commentsDescription',
    'commentsLoading',
    'commentsLoadError',
    'privacyNotice',
    'privacyLinkLabel',
    'privacyPolicyUrl',
    'languageSwitcherLabel',
  ] as const
  const result = Object.fromEntries(keys.map((key) => [key, readRequiredString(value, key)]))
  if (Object.values(result).some((item) => !item)) throw new ConfigValidationError(`locales.${locale}.ui.fields`)
  if (!isPublicWebUrl(result.privacyPolicyUrl!)) {
    throw new ConfigValidationError(`locales.${locale}.ui.privacyPolicyUrl`)
  }
  return result as unknown as UiConfig
}

/** 校验单个渠道的本地化文案，喵~ */
function parseLocalizedChannel(value: unknown, locale: SupportedLocale, id: string): LocalizedRewardChannel {
  if (!isRecord(value)) throw new ConfigValidationError(`locales.${locale}.channels.${id}`)
  const name = readRequiredString(value, 'name')
  const alt = readRequiredString(value, 'alt')
  const description = readOptionalString(value, 'description')
  if (!name || !alt) throw new ConfigValidationError(`locales.${locale}.channels.${id}.fields`)
  if (value.description !== undefined && typeof value.description !== 'string') {
    throw new ConfigValidationError(`locales.${locale}.channels.${id}.description`)
  }
  return { name, alt, description }
}

/** 校验单种语言的全部页面内容，喵~ */
function parseLocalizedContent(
  value: unknown,
  locale: SupportedLocale,
  channelIds: string[],
  hasProfile: boolean,
): LocalizedPageContent {
  if (!isRecord(value)) throw new ConfigValidationError(`locales.${locale}`)
  if (!isRecord(value.meta)) throw new ConfigValidationError(`locales.${locale}.meta`)
  const title = readRequiredString(value.meta, 'title')
  const description = readRequiredString(value.meta, 'description')
  if (!title || !description) throw new ConfigValidationError(`locales.${locale}.meta.fields`)

  const profile = parseLocalizedProfile(value.profile, locale)
  if (hasProfile !== Boolean(profile)) throw new ConfigValidationError(`locales.${locale}.profile.presence`)

  if (!isRecord(value.channels)) throw new ConfigValidationError(`locales.${locale}.channels`)
  const localizedChannels = value.channels
  const translatedIds = Object.keys(localizedChannels)
  if (translatedIds.length !== channelIds.length || translatedIds.some((id) => !channelIds.includes(id))) {
    throw new ConfigValidationError(`locales.${locale}.channels.ids`)
  }
  const channels = Object.fromEntries(
    channelIds.map((id) => [id, parseLocalizedChannel(localizedChannels[id], locale, id)]),
  )

  return {
    meta: { title, description },
    profile,
    ui: parseUi(value.ui, locale),
    channels,
  }
}

/** 保证可选本地化字段不会只在部分语言中缺失，喵~ */
function validateOptionalFieldParity(locales: Record<SupportedLocale, LocalizedPageContent>, channelIds: string[]): void {
  const [firstLocale, ...otherLocales] = SUPPORTED_LOCALES
  const firstProfile = locales[firstLocale].profile
  for (const locale of otherLocales) {
    const profile = locales[locale].profile
    for (const key of ['name', 'headline', 'intro', 'avatarAlt'] as const) {
      if (Boolean(firstProfile?.[key]) !== Boolean(profile?.[key])) {
        throw new ConfigValidationError(`locales.${locale}.profile.${key}.parity`)
      }
    }
    for (const id of channelIds) {
      if (Boolean(locales[firstLocale].channels[id]?.description) !== Boolean(locales[locale].channels[id]?.description)) {
        throw new ConfigValidationError(`locales.${locale}.channels.${id}.description.parity`)
      }
    }
  }
}

/** 将未知 JSON 数据解析为经过校验的双语赞赏页配置，喵~ */
export function parseAppConfig(value: unknown): AppConfig {
  if (!isRecord(value)) throw new ConfigValidationError('root')
  if (!Array.isArray(value.channels)) throw new ConfigValidationError('channels')

  const channels = value.channels.map(parseSharedChannel)
  const channelIds = channels.map((channel) => channel.id)
  if (new Set(channelIds).size !== channelIds.length) throw new ConfigValidationError('channels.duplicateId')

  const profile = parseSharedProfile(value.profile)
  if (!isRecord(value.locales)) throw new ConfigValidationError('locales')
  const localizedConfigs = value.locales
  const configuredLocales = Object.keys(localizedConfigs)
  if (
    configuredLocales.length !== SUPPORTED_LOCALES.length
    || configuredLocales.some((locale) => !SUPPORTED_LOCALES.includes(locale as SupportedLocale))
  ) {
    throw new ConfigValidationError('locales.keys')
  }

  const locales = Object.fromEntries(SUPPORTED_LOCALES.map((locale) => [
    locale,
    parseLocalizedContent(localizedConfigs[locale], locale, channelIds, profile !== undefined),
  ])) as Record<SupportedLocale, LocalizedPageContent>
  validateOptionalFieldParity(locales, channelIds)

  if (profile?.avatar) {
    for (const locale of SUPPORTED_LOCALES) {
      if (!locales[locale].profile?.avatarAlt) {
        throw new ConfigValidationError(`locales.${locale}.profile.avatarAlt`)
      }
    }
  }

  return {
    defaultLocale: parseLocale(value.defaultLocale, 'defaultLocale'),
    socialLocale: parseLocale(value.socialLocale, 'socialLocale'),
    meta: parseSharedMeta(value.meta),
    profile,
    comments: parseComments(value.comments),
    channels,
    locales,
  }
}

/** 合并共享结构和指定语言内容，生成可直接渲染的配置，喵~ */
export function resolveAppConfig(config: AppConfig, locale: SupportedLocale): ResolvedAppConfig {
  const localized = config.locales[locale]
  return {
    meta: { ...config.meta, ...localized.meta },
    profile: config.profile && localized.profile ? { ...config.profile, ...localized.profile } : undefined,
    comments: config.comments,
    ui: localized.ui,
    channels: config.channels.map((channel) => ({ ...channel, ...localized.channels[channel.id]! })),
  }
}

/** 读取并校验构建时注入的赞赏页配置，喵~ */
export function loadAppConfig(value: unknown = __APP_CONFIG__): AppConfig {
  return parseAppConfig(value)
}
