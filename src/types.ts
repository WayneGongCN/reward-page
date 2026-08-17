export type PageMode = 'full' | 'embed'

export interface SiteMeta {
  title: string
  description: string
  canonicalUrl: string
  shareImage: string
}

export interface ProfileConfig {
  avatar?: string
  name?: string
  headline?: string
  intro?: string[]
}

export interface UiConfig {
  channelsTitle: string
  configError: string
  noChannels: string
  imageError: string
  privacyNotice: string
  privacyLinkLabel: string
  privacyPolicyUrl: string
}

export interface RewardChannel {
  id: string
  name: string
  qrImage: string
  alt: string
  description?: string
}

export interface AppConfig {
  meta: SiteMeta
  profile?: ProfileConfig
  ui: UiConfig
  channels: RewardChannel[]
}

export interface PageOptions {
  mode: PageMode
  introVisible: boolean
  visibleChannelIds: string[]
}
