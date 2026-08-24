import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ConfigValidationError, isSafeAssetPath, loadAppConfig, parseAppConfig, resolveAppConfig } from './config'

const validUi = {
  channelsTitle: '选择方式',
  configError: '加载失败',
  noChannels: '没有渠道',
  imageError: '图片失败',
  addressLabel: '钱包地址',
  copyAddress: '复制地址',
  copySuccess: '已复制',
  copyFailure: '复制失败',
  commentsTitle: '留言',
  commentsDescription: '评论公开保存到 GitHub Issues',
  commentsLoading: '正在加载评论',
  commentsLoadError: '评论加载失败',
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
  comments: {
    repository: 'WayneGongCN/reward-page',
    label: 'comments',
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

  it('解析并修剪合法的 GitHub 评论配置', () => {
    const input = structuredClone(validConfig)
    input.comments.repository = ' WayneGongCN/reward-page '
    input.comments.label = ' comments '
    expect(parseAppConfig(input).comments).toEqual({
      repository: 'WayneGongCN/reward-page',
      label: 'comments',
    })
  })

  it.each([
    ['缺少斜杠', 'WayneGongCN-reward-page'],
    ['存在额外路径', 'WayneGongCN/reward-page/issues'],
    ['仓库包含空格', 'WayneGongCN/reward page'],
  ])('拒绝%s形式的评论仓库名', (_name, repository) => {
    const input = structuredClone(validConfig)
    input.comments.repository = repository
    expect(() => parseAppConfig(input)).toThrowError(new ConfigValidationError('comments.repository'))
  })

  it('拒绝空评论标签', () => {
    const input = structuredClone(validConfig)
    input.comments.label = '  '
    expect(() => parseAppConfig(input)).toThrowError(new ConfigValidationError('comments.fields'))
  })

  it('拒绝评论本地化文案缺失', () => {
    const input = structuredClone(validConfig)
    input.locales.en.ui.commentsLoadError = ''
    expect(() => parseAppConfig(input)).toThrowError(new ConfigValidationError('locales.en.ui.fields'))
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

  it('解析并修剪可复制公开文本，同时保持未配置渠道向后兼容', () => {
    const input: any = structuredClone(validConfig)
    input.channels.push({
      id: 'btc',
      qrImage: '/assets/btc.svg',
      copyValue: '  bc1q-test-address  ',
    })
    for (const locale of ['zh-CN', 'en'] as const) {
      input.locales[locale].channels.btc = {
        name: 'Bitcoin',
        alt: 'Bitcoin QR code',
        description: 'Test address',
      }
    }

    const config = parseAppConfig(input)
    expect(config.channels[0]).toEqual({ id: 'wechat', qrImage: '/assets/wechat.svg' })
    expect(config.channels[1]).toEqual({
      id: 'btc',
      qrImage: '/assets/btc.svg',
      copyValue: 'bc1q-test-address',
    })
  })

  it.each([
    ['空字符串', '  '],
    ['非字符串', 123],
  ])('拒绝%s形式的可复制公开文本', (_name, copyValue) => {
    const input: any = structuredClone(validConfig)
    input.channels[0].copyValue = copyValue
    expect(() => parseAppConfig(input)).toThrowError(new ConfigValidationError('channels.0.copyValue'))
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
    expect(resolved.comments).toEqual({ repository: 'WayneGongCN/reward-page', label: 'comments' })
    expect(resolved.channels).toEqual([{
      id: 'wechat',
      qrImage: '/assets/wechat.svg',
      name: 'WeChat',
      alt: 'WeChat QR code',
      description: 'Scan to support',
    }])
  })

  it('将可复制公开文本合并到已解析渠道', () => {
    const input: any = structuredClone(validConfig)
    input.channels[0].copyValue = 'bc1q-test-address'
    expect(resolveAppConfig(parseAppConfig(input), 'en').channels[0]?.copyValue).toBe('bc1q-test-address')
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
