const USDC_DISPLAY_PATTERN = /^(?:0|[1-9]\d*)(?:\.(\d{1,2}))?$/

/** 将最多两位小数的 USDC 展示金额转换为整数美分，喵~ */
export function parseUsdcCents(value: string): number | undefined {
  const normalized = value.trim()
  const match = USDC_DISPLAY_PATTERN.exec(normalized)
  if (!match) return undefined
  const [wholePart, decimalPart = ''] = normalized.split('.')
  const whole = Number(wholePart)
  if (!Number.isSafeInteger(whole)) return undefined
  const cents = whole * 100 + Number(decimalPart.padEnd(2, '0'))
  return Number.isSafeInteger(cents) && cents > 0 ? cents : undefined
}

/** 将整数美分格式化为 Base Pay 接受的两位小数字符串，喵~ */
export function formatUsdcCents(cents: number): string {
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`
}

/** 校验并规范化用户输入的 USDC 金额范围，喵~ */
export function normalizeUsdcAmount(value: string, min: string, max: string): string | undefined {
  const cents = parseUsdcCents(value)
  const minCents = parseUsdcCents(min)
  const maxCents = parseUsdcCents(max)
  if (cents === undefined || minCents === undefined || maxCents === undefined) return undefined
  return cents >= minCents && cents <= maxCents ? formatUsdcCents(cents) : undefined
}
