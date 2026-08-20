import type { AppConfig, ProfileConfig, RewardChannel, SiteMeta, UiConfig } from './types'

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

/** 校验站点元信息配置，喵~ */
function parseMeta(value: unknown): SiteMeta {
  if (!isRecord(value)) throw new ConfigValidationError('meta')
  const title = readRequiredString(value, 'title')
  const description = readRequiredString(value, 'description')
  const canonicalUrl = readRequiredString(value, 'canonicalUrl')
  const shareImage = readRequiredString(value, 'shareImage')
  if (!title || !description || !canonicalUrl || !shareImage) throw new ConfigValidationError('meta.fields')
  if (!isPublicWebUrl(canonicalUrl)) throw new ConfigValidationError('meta.canonicalUrl')
  if (!isSafeAssetPath(shareImage)) throw new ConfigValidationError('meta.shareImage')
  return { title, description, canonicalUrl, shareImage }
}

/** 校验可选个人资料配置，喵~ */
function parseProfile(value: unknown): ProfileConfig | undefined {
  if (value === undefined) return undefined
  if (!isRecord(value)) throw new ConfigValidationError('profile')
  const avatar = readOptionalString(value, 'avatar')
  const name = readOptionalString(value, 'name')
  const headline = readOptionalString(value, 'headline')
  if (value.avatar !== undefined && typeof value.avatar !== 'string') throw new ConfigValidationError('profile.avatar')
  if (avatar && !isSafeAssetPath(avatar)) throw new ConfigValidationError('profile.avatar')
  if (value.name !== undefined && typeof value.name !== 'string') throw new ConfigValidationError('profile.name')
  if (value.headline !== undefined && typeof value.headline !== 'string') throw new ConfigValidationError('profile.headline')

  let intro: string[] | undefined
  if (value.intro !== undefined) {
    if (!Array.isArray(value.intro) || !value.intro.every((item) => typeof item === 'string' && item.trim())) {
      throw new ConfigValidationError('profile.intro')
    }
    intro = value.intro.map((item) => item.trim())
  }
  return { avatar, name, headline, intro }
}

/** 校验界面文案和隐私说明配置，喵~ */
function parseUi(value: unknown): UiConfig {
  if (!isRecord(value)) throw new ConfigValidationError('ui')
  const keys = [
    'channelsTitle',
    'configError',
    'noChannels',
    'imageError',
    'privacyNotice',
    'privacyLinkLabel',
    'privacyPolicyUrl',
  ] as const
  const result = Object.fromEntries(keys.map((key) => [key, readRequiredString(value, key)]))
  if (Object.values(result).some((item) => !item)) throw new ConfigValidationError('ui.fields')
  if (!isPublicWebUrl(result.privacyPolicyUrl!)) throw new ConfigValidationError('ui.privacyPolicyUrl')
  return result as unknown as UiConfig
}

/** 校验单个赞赏渠道配置，喵~ */
function parseChannel(value: unknown, index: number): RewardChannel {
  if (!isRecord(value)) throw new ConfigValidationError(`channels.${index}`)
  const id = readRequiredString(value, 'id')
  const name = readRequiredString(value, 'name')
  const qrImage = readRequiredString(value, 'qrImage')
  const alt = readRequiredString(value, 'alt')
  const description = readOptionalString(value, 'description')
  if (!id || !name || !qrImage || !alt) throw new ConfigValidationError(`channels.${index}.fields`)
  if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) throw new ConfigValidationError(`channels.${index}.id`)
  if (!isSafeAssetPath(qrImage)) throw new ConfigValidationError(`channels.${index}.qrImage`)
  if (value.description !== undefined && typeof value.description !== 'string') {
    throw new ConfigValidationError(`channels.${index}.description`)
  }
  return { id, name, qrImage, alt, description }
}

/** 将未知 JSON 数据解析为经过校验的赞赏页配置，喵~ */
export function parseAppConfig(value: unknown): AppConfig {
  if (!isRecord(value)) throw new ConfigValidationError('root')
  if (!Array.isArray(value.channels)) throw new ConfigValidationError('channels')

  const channels = value.channels.map(parseChannel)
  const ids = channels.map((channel) => channel.id)
  if (new Set(ids).size !== ids.length) throw new ConfigValidationError('channels.duplicateId')

  return {
    meta: parseMeta(value.meta),
    profile: parseProfile(value.profile),
    ui: parseUi(value.ui),
    channels,
  }
}

/** 读取并校验构建时注入的赞赏页配置，喵~ */
export function loadAppConfig(value: unknown = __APP_CONFIG__): AppConfig {
  return parseAppConfig(value)
}
