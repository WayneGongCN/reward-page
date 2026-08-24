import { describe, expect, it } from 'vitest'
import { formatUsdcCents, normalizeUsdcAmount, parseUsdcCents } from './usdc-amount'

describe('USDC 金额工具', () => {
  it.each([
    ['0.10', 10],
    ['1', 100],
    ['3.0', 300],
    ['100.00', 10_000],
  ])('将 %s 转为整数美分', (amount, cents) => {
    expect(parseUsdcCents(amount)).toBe(cents)
  })

  it.each(['', '0', '00.10', '.10', '1.001', '-1', '+1', '1e2'])('拒绝非法金额 %s', (amount) => {
    expect(parseUsdcCents(amount)).toBeUndefined()
  })

  it('统一格式化为两位小数', () => {
    expect(formatUsdcCents(10)).toBe('0.10')
    expect(normalizeUsdcAmount('3.0', '0.10', '100.00')).toBe('3.00')
    expect(normalizeUsdcAmount('invalid', '0.10', '100.00')).toBeUndefined()
    expect(normalizeUsdcAmount('0.09', '0.10', '100.00')).toBeUndefined()
    expect(normalizeUsdcAmount('100.01', '0.10', '100.00')).toBeUndefined()
  })
})
