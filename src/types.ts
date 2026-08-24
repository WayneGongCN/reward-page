export const SUPPORTED_LOCALES = ['zh-CN', 'en'] as const

export type SupportedLocale = typeof SUPPORTED_LOCALES[number]

export type PageMode = 'full' | 'embed'

export interface SharedSiteMeta {
  canonicalUrl: string
  shareImage: string
}

export interface LocalizedSiteMeta {
  title: string
  description: string
}

export interface SiteMeta extends SharedSiteMeta, LocalizedSiteMeta {}

export interface SharedProfileConfig {
  avatar?: string
}

export interface LocalizedProfileConfig {
  name?: string
  headline?: string
  intro?: string[]
  avatarAlt?: string
}

export interface ProfileConfig extends SharedProfileConfig, LocalizedProfileConfig {}

export interface CommentsConfig {
  repository: string
  label: string
}

export interface UiConfig {
  channelsTitle: string
  configError: string
  noChannels: string
  imageError: string
  addressLabel: string
  copyAddress: string
  copySuccess: string
  copyFailure: string
  pageTabsLabel: string
  rewardTabLabel: string
  commentsTabLabel: string
  commentsTitle: string
  commentsDescription: string
  commentsLoading: string
  commentsLoadError: string
  privacyNotice: string
  privacyLinkLabel: string
  privacyPolicyUrl: string
  languageSwitcherLabel: string
}

export interface SharedRewardChannel {
  id: string
  qrImage: string
  copyValue?: string
}

export interface LocalizedRewardChannel {
  name: string
  alt: string
  description?: string
}

export interface RewardChannel extends SharedRewardChannel, LocalizedRewardChannel {}

export interface LocalizedPageContent {
  meta: LocalizedSiteMeta
  profile?: LocalizedProfileConfig
  ui: UiConfig
  channels: Record<string, LocalizedRewardChannel>
}

export interface AppConfig {
  defaultLocale: SupportedLocale
  socialLocale: SupportedLocale
  meta: SharedSiteMeta
  profile?: SharedProfileConfig
  comments: CommentsConfig
  channels: SharedRewardChannel[]
  locales: Record<SupportedLocale, LocalizedPageContent>
}

export interface ResolvedAppConfig {
  meta: SiteMeta
  profile?: ProfileConfig
  comments: CommentsConfig
  ui: UiConfig
  channels: RewardChannel[]
}

export interface PageOptions {
  mode: PageMode
  introVisible: boolean
  commentsVisible: boolean
  visibleChannelIds: string[]
}
