import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

interface HeaderEntry {
  key: string
  value: string
}

interface HeaderRule {
  source: string
  headers: HeaderEntry[]
}

/** 读取部署配置中的全站 CSP，喵~ */
function readContentSecurityPolicy(): string {
  const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8')) as {
    headers: HeaderRule[]
  }
  const globalRule = config.headers.find((rule) => rule.source === '/(.*)')
  return globalRule?.headers.find((header) => header.key === 'Content-Security-Policy')?.value ?? ''
}

describe('评论系统安全配置', () => {
  it('只为 utterances 增加脚本与 iframe 来源，并显式允许其动态样式', () => {
    const policy = readContentSecurityPolicy()
    expect(policy).toContain("script-src 'self' https://www.googletagmanager.com https://utteranc.es")
    expect(policy).toContain("style-src 'self' 'unsafe-inline'")
    expect(policy).toContain('frame-src https://utteranc.es')
    expect(policy).toContain("object-src 'none'")
    expect(policy).toContain("form-action 'none'")
  })

  it('utterances 仅允许生产域名发评论', () => {
    const config = JSON.parse(readFileSync(new URL('../utterances.json', import.meta.url), 'utf8'))
    expect(config).toEqual({ origins: ['https://reward.waynegong.cn'] })
  })
})
