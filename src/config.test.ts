import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ConfigValidationError, isSafeAssetPath, loadAppConfig, parseAppConfig, resolveAppConfig } from './config'

const validUi = {
  channelsTitle: '选择方式',
  configError: '加载失败',
  noChannels: '没有渠道',
  imageError: '图片失败',
  privacyNotice: '匿名统计',
  privacyLinkLabel: '隐私政策',
  privacyPolicyUrl: 'https://policies.google.com/privacy',
  languageSwitcherLabel: '选择语言',
}

const validConfig = {
  defaultLocale: 'zh-CN',
  socialLocale: 'en',
  meta: {
    canonicalUrl: 'https://example.com/',
    shareImage: '/assets/share.svg',
  },
  profile: {
    avatar: '/assets/avatar.svg',
  },
  channels: [
    {
      id: 'wechat',
      qrImage: '/assets/wechat.svg',
    },
  ],
  locales: {
    'zh-CN': {
      meta: { title: '赞赏页', description: '描述' },
      profile: { name: 'Wayne', headline: '谢谢支持', intro: ['第一段', '第二段'], avatarAlt: 'Wayne 的头像' },
      ui: validUi,
      channels: {
        wechat: { name: '微信', alt: '微信二维码', description: '扫码支持' },
      },
    },
    en: {
      meta: { title: 'Reward Page', description: 'Description' },
      profile: { name: 'Wayne', headline: 'Thank you', intro: ['First', 'Second'], avatarAlt: "Wayne's avatar" },
      ui: { ...validUi, languageSwitcherLabel: 'Choose language' },
      channels: {
        wechat: { name: 'WeChat', alt: 'WeChat QR code', description: 'Scan to support' },
      },
    },
  },
}

describe('parseAppConfig', () => {
  it('项目公开配置始终可以通过构建时校验', () => {
    const publicConfig = JSON.parse(readFileSync(new URL('../public/config.json', import.meta.url), 'utf8'))
    expect(() => parseAppConfig(publicConfig)).not.toThrow()
  })

  it('解析合法双语配置并修剪本地化文案空白', () => {
    const input = structuredClone(validConfig)
    input.locales['zh-CN'].profile.name = ' Wayne '
    input.locales.en.profile.name = ' Wayne '
    input.locales['zh-CN'].profile.intro = [' 你好 ']
    input.locales.en.profile.intro = [' Hello ']
    const config = parseAppConfig(input)
    expect(config.locales['zh-CN'].profile).toMatchObject({ name: 'Wayne', intro: ['你好'] })
    expect(config.locales.en.profile).toMatchObject({ name: 'Wayne', intro: ['Hello'] })
  })

  it('将两种语言中一致的可选空文本归一化为未配置', () => {
    const input = structuredClone(validConfig)
    for (const locale of ['zh-CN', 'en'] as const) {
      input.locales[locale].profile.headline = '  '
      input.locales[locale].channels.wechat.description = ''
    }
    const config = parseAppConfig(input)
    expect(config.locales['zh-CN'].profile?.headline).toBeUndefined()
    expect(config.locales.en.channels.wechat?.description).toBeUndefined()
  })

  it('仍然拒绝可选文本字段的非字符串值', () => {
    const input: any = structuredClone(validConfig)
    input.locales.en.profile.name = 123
    expect(() => parseAppConfig(input)).toThrowError(new ConfigValidationError('locales.en.profile.name'))
  })

  it('允许省略个人资料和使用零渠道配置', () => {
    const input: any = structuredClone(validConfig)
    delete input.profile
    input.channels = []
    for (const locale of ['zh-CN', 'en'] as const) {
      delete input.locales[locale].profile
      input.locales[locale].channels = {}
    }
    const config = parseAppConfig(input)
    expect(config.profile).toBeUndefined()
    expect(config.channels).toEqual([])
  })

  it('拒绝重复渠道 ID', () => {
    const input = structuredClone(validConfig)
    input.channels.push(input.channels[0]!)
    expect(() => parseAppConfig(input)).toThrowError(new ConfigValidationError('channels.duplicateId'))
  })

  it('拒绝缺少或额外的语言', () => {
    const missing: any = structuredClone(validConfig)
    delete missing.locales.en
    expect(() => parseAppConfig(missing)).toThrowError(new ConfigValidationError('locales.keys'))

    const extra: any = structuredClone(validConfig)
    extra.locales.fr = extra.locales.en
    expect(() => parseAppConfig(extra)).toThrowError(new ConfigValidationError('locales.keys'))
  })

  it('拒绝本地化渠道缺失或多余', () => {
    const missing: any = structuredClone(validConfig)
    delete missing.locales.en.channels.wechat
    expect(() => parseAppConfig(missing)).toThrowError(new ConfigValidationError('locales.en.channels.ids'))

    const extra: any = structuredClone(validConfig)
    extra.locales.en.channels.alipay = extra.locales.en.channels.wechat
    expect(() => parseAppConfig(extra)).toThrowError(new ConfigValidationError('locales.en.channels.ids'))
  })

  it('拒绝非法默认语言和分享语言', () => {
    expect(() => parseAppConfig({ ...validConfig, defaultLocale: 'fr' }))
      .toThrowError(new ConfigValidationError('defaultLocale'))
    expect(() => parseAppConfig({ ...validConfig, socialLocale: 'fr' }))
      .toThrowError(new ConfigValidationError('socialLocale'))
  })

  it('拒绝只在单种语言中存在的可选文案', () => {
    const input = structuredClone(validConfig)
    input.locales.en.profile.headline = ''
    expect(() => parseAppConfig(input)).toThrowError(new ConfigValidationError('locales.en.profile.headline.parity'))
  })

  it('配置头像时要求两种语言都提供替代文本', () => {
    const input = structuredClone(validConfig)
    input.locales.en.profile.avatarAlt = ''
    expect(() => parseAppConfig(input)).toThrowError(ConfigValidationError)
  })

  it('拒绝外部或可穿越目录的资源路径', () => {
    expect(isSafeAssetPath('/assets/qr.svg')).toBe(true)
    expect(isSafeAssetPath('./assets/qr.svg')).toBe(true)
    expect(isSafeAssetPath('https://example.com/qr.svg')).toBe(false)
    expect(isSafeAssetPath('/assets/../secret')).toBe(false)
    expect(isSafeAssetPath('//example.com/qr.svg')).toBe(false)
  })

  it('拒绝非法二维码资源地址', () => {
    const input = structuredClone(validConfig)
    input.channels[0]!.qrImage = 'https://example.com/qr.svg'
    expect(() => parseAppConfig(input)).toThrowError(ConfigValidationError)
  })
})

describe('resolveAppConfig', () => {
  it('合并共享资源与指定语言内容并保持渠道顺序', () => {
    const resolved = resolveAppConfig(parseAppConfig(validConfig), 'en')
    expect(resolved.meta).toEqual({
      canonicalUrl: 'https://example.com/',
      shareImage: '/assets/share.svg',
      title: 'Reward Page',
      description: 'Description',
    })
    expect(resolved.profile).toMatchObject({ avatar: '/assets/avatar.svg', name: 'Wayne' })
    expect(resolved.channels).toEqual([{
      id: 'wechat',
      qrImage: '/assets/wechat.svg',
      name: 'WeChat',
      alt: 'WeChat QR code',
      description: 'Scan to support',
    }])
  })
})

describe('loadAppConfig', () => {
  it('读取并校验构建时注入的双语配置', () => {
    expect(loadAppConfig(validConfig)).toMatchObject({ defaultLocale: 'zh-CN', socialLocale: 'en' })
  })

  it('拒绝非法的构建时配置', () => {
    expect(() => loadAppConfig({})).toThrowError(ConfigValidationError)
  })
})
