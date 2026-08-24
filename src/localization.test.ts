import { describe, expect, it, vi } from 'vitest'
import { detectLocale, LOCALE_STORAGE_KEY, matchSupportedLocale, persistLocale } from './localization'

describe('matchSupportedLocale', () => {
  it.each([
    ['zh', 'zh-CN'],
    ['zh-CN', 'zh-CN'],
    ['zh-TW', 'zh-CN'],
    ['ZH_Hant', 'zh-CN'],
    ['en', 'en'],
    ['en-US', 'en'],
    ['EN_gb', 'en'],
  ] as const)('将 %s 映射为 %s', (language, expected) => {
    expect(matchSupportedLocale(language)).toBe(expected)
  })

  it('忽略不支持或空的语言标签', () => {
    expect(matchSupportedLocale('fr-FR')).toBeUndefined()
    expect(matchSupportedLocale('')).toBeUndefined()
  })
})

describe('detectLocale', () => {
  it('用户保存值优先于浏览器偏好', () => {
    const storage = { getItem: vi.fn(() => 'en'), setItem: vi.fn() }
    expect(detectLocale('zh-CN', { storage, languages: ['zh-CN'] })).toBe('en')
    expect(storage.getItem).toHaveBeenCalledWith(LOCALE_STORAGE_KEY)
  })

  it('跳过不支持语言并选择首个可匹配项', () => {
    expect(detectLocale('zh-CN', { storage: null, languages: ['fr-FR', 'en-US', 'zh-CN'] })).toBe('en')
  })

  it('非法保存值不会覆盖浏览器偏好', () => {
    const storage = { getItem: () => 'fr', setItem: vi.fn() }
    expect(detectLocale('zh-CN', { storage, languages: ['en-GB'] })).toBe('en')
  })

  it('全部语言不支持时回退配置默认语言', () => {
    expect(detectLocale('zh-CN', { storage: null, languages: ['fr-FR', 'ja-JP'] })).toBe('zh-CN')
  })

  it('读取存储异常时继续使用浏览器偏好', () => {
    const storage = {
      getItem: () => { throw new Error('blocked') },
      setItem: vi.fn(),
    }
    expect(detectLocale('zh-CN', { storage, languages: ['en-US'] })).toBe('en')
  })
})

describe('persistLocale', () => {
  it('使用固定键保存用户选择', () => {
    const storage = { getItem: vi.fn(), setItem: vi.fn() }
    persistLocale('en', storage)
    expect(storage.setItem).toHaveBeenCalledWith(LOCALE_STORAGE_KEY, 'en')
  })

  it('写入存储异常时保持静默', () => {
    const storage = {
      getItem: vi.fn(),
      setItem: () => { throw new Error('blocked') },
    }
    expect(() => persistLocale('en', storage)).not.toThrow()
  })
})
