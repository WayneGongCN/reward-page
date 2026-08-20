import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ConfigValidationError, isSafeAssetPath, loadAppConfig, parseAppConfig } from './config'

const validConfig = {
  meta: {
    title: '赞赏页',
    description: '描述',
    canonicalUrl: 'https://example.com/',
    shareImage: '/assets/share.svg',
  },
  profile: {
    avatar: '/assets/avatar.svg',
    name: 'Wayne',
    headline: '谢谢支持',
    intro: ['第一段', '第二段'],
  },
  ui: {
    channelsTitle: '选择方式',
    configError: '加载失败',
    noChannels: '没有渠道',
    imageError: '图片失败',
    privacyNotice: '匿名统计',
    privacyLinkLabel: '隐私政策',
    privacyPolicyUrl: 'https://policies.google.com/privacy',
  },
  channels: [
    {
      id: 'wechat',
      name: '微信',
      qrImage: '/assets/wechat.svg',
      alt: '微信二维码',
      description: '扫码支持',
    },
  ],
}

describe('parseAppConfig', () => {
  it('项目公开配置始终可以通过运行时校验', () => {
    const publicConfig = JSON.parse(readFileSync(new URL('../public/config.json', import.meta.url), 'utf8'))
    expect(() => parseAppConfig(publicConfig)).not.toThrow()
  })

  it('解析合法配置并修剪文案空白', () => {
    const config = parseAppConfig({
      ...validConfig,
      profile: { name: ' Wayne ', intro: [' 你好 '] },
    })
    expect(config.profile).toEqual({
      avatar: undefined,
      name: 'Wayne',
      headline: undefined,
      intro: ['你好'],
    })
  })

  it('将可选文本字段的空值归一化为未配置', () => {
    const config = parseAppConfig({
      ...validConfig,
      profile: { avatar: '', name: '   ', headline: '\t', intro: ['你好'] },
      channels: [{ ...validConfig.channels[0], description: '' }],
    })
    expect(config.profile).toEqual({
      avatar: undefined,
      name: undefined,
      headline: undefined,
      intro: ['你好'],
    })
    expect(config.channels[0]?.description).toBeUndefined()
  })

  it('仍然拒绝可选文本字段的非字符串值', () => {
    expect(() => parseAppConfig({
      ...validConfig,
      profile: { name: 123 },
    })).toThrowError(new ConfigValidationError('profile.name'))
  })

  it('允许省略个人资料和使用零渠道配置', () => {
    const { profile: _profile, ...withoutProfile } = validConfig
    expect(parseAppConfig({ ...withoutProfile, channels: [] }).channels).toEqual([])
  })

  it('拒绝重复渠道 ID', () => {
    expect(() => parseAppConfig({
      ...validConfig,
      channels: [validConfig.channels[0], validConfig.channels[0]],
    })).toThrowError(new ConfigValidationError('channels.duplicateId'))
  })

  it('拒绝外部或可穿越目录的资源路径', () => {
    expect(isSafeAssetPath('/assets/qr.svg')).toBe(true)
    expect(isSafeAssetPath('./assets/qr.svg')).toBe(true)
    expect(isSafeAssetPath('https://example.com/qr.svg')).toBe(false)
    expect(isSafeAssetPath('/assets/../secret')).toBe(false)
    expect(isSafeAssetPath('//example.com/qr.svg')).toBe(false)
  })

  it('拒绝非法二维码资源地址', () => {
    expect(() => parseAppConfig({
      ...validConfig,
      channels: [{ ...validConfig.channels[0], qrImage: 'https://example.com/qr.svg' }],
    })).toThrowError(ConfigValidationError)
  })
})

describe('loadAppConfig', () => {
  it('读取并校验构建时注入的配置', () => {
    expect(loadAppConfig(validConfig)).toMatchObject({ meta: validConfig.meta })
  })

  it('拒绝非法的构建时配置', () => {
    expect(() => loadAppConfig({})).toThrowError(ConfigValidationError)
  })
})
