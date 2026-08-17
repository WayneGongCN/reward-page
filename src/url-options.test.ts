import { describe, expect, it } from 'vitest'
import { parsePageOptions } from './url-options'

const channelIds = ['wechat', 'alipay', 'buymeacoffee']

describe('parsePageOptions', () => {
  it('默认使用完整模式、展示简介和全部渠道', () => {
    expect(parsePageOptions('', channelIds)).toEqual({
      mode: 'full',
      introVisible: true,
      visibleChannelIds: channelIds,
    })
  })

  it('嵌入模式默认隐藏简介', () => {
    expect(parsePageOptions('?mode=embed', channelIds)).toEqual({
      mode: 'embed',
      introVisible: false,
      visibleChannelIds: channelIds,
    })
  })

  it('简介参数覆盖模式默认值', () => {
    expect(parsePageOptions('?mode=embed&intro=1', channelIds).introVisible).toBe(true)
    expect(parsePageOptions('?intro=0', channelIds).introVisible).toBe(false)
    expect(parsePageOptions('?mode=embed&intro=yes', channelIds).introVisible).toBe(false)
  })

  it('渠道筛选去重、忽略未知值并保留配置顺序', () => {
    expect(parsePageOptions('?channels=alipay,wechat,alipay,unknown', channelIds).visibleChannelIds)
      .toEqual(['wechat', 'alipay'])
  })

  it('空渠道参数隐藏全部渠道', () => {
    expect(parsePageOptions('?channels=', channelIds).visibleChannelIds).toEqual([])
  })

  it('非法模式回退到完整模式', () => {
    expect(parsePageOptions('?mode=compact', channelIds).mode).toBe('full')
  })
})
