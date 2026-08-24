// @vitest-environment happy-dom // 使用轻量浏览器环境验证轮询计时，喵~

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const sdkMocks = vi.hoisted(() => ({
  pay: vi.fn(),
  getPaymentStatus: vi.fn(),
}))

vi.mock('@base-org/account/payment/browser', () => sdkMocks)

const recipient = '0xEF787423A25713C0c979d4F5323FB05b2C2b5D38'

beforeEach(() => {
  vi.resetModules()
  sdkMocks.pay.mockReset()
  sdkMocks.getPaymentStatus.mockReset()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('Base Pay 状态机', () => {
  it('未知构建值安全回退测试网', async () => {
    const { getBasePayNetwork } = await import('./base-pay')
    expect(getBasePayNetwork('base')).toBe('base')
    expect(getBasePayNetwork('base-sepolia')).toBe('base-sepolia')
    expect(getBasePayNetwork('unknown')).toBe('base-sepolia')
    expect(getBasePayNetwork(undefined)).toBe('base-sepolia')
  })

  it('按固定参数发起主网支付并校验预期收款', async () => {
    sdkMocks.pay.mockResolvedValue({ id: 'payment-1' })
    sdkMocks.getPaymentStatus.mockResolvedValue({ status: 'completed' })
    const module = await import('./base-pay')
    const states: string[] = []
    const results: string[] = []
    module.bindBasePayView((state) => states.push(state.phase))
    module.configureBasePay('3.00')
    await module.preloadBasePaySdk()

    await module.startBasePayPayment({
      amount: '5.00',
      recipient,
      network: 'base',
      onStart: vi.fn(),
      onResult: (result) => results.push(result),
    })

    expect(sdkMocks.pay).toHaveBeenCalledWith({
      amount: '5.00',
      to: recipient,
      testnet: false,
      telemetry: false,
    })
    expect(sdkMocks.getPaymentStatus).toHaveBeenCalledWith({
      id: 'payment-1',
      expectedPayment: { amount: '5.00', recipient },
      testnet: false,
      telemetry: false,
    })
    expect(states).toContain('confirming')
    expect(states.at(-1)).toBe('success')
    expect(results).toEqual(['completed'])
  })

  it('区分用户取消和普通失败并允许再次支付', async () => {
    sdkMocks.pay
      .mockRejectedValueOnce({ code: 4001 })
      .mockRejectedValueOnce(new Error('wallet error'))
    const module = await import('./base-pay')
    const results: string[] = []
    module.configureBasePay('3.00')
    await module.preloadBasePaySdk()

    const options = {
      amount: '3.00',
      recipient,
      network: 'base-sepolia' as const,
      onStart: vi.fn(),
      onResult: (result: string) => results.push(result),
    }
    await module.startBasePayPayment(options)
    await module.startBasePayPayment(options)

    expect(results).toEqual(['cancelled', 'failed'])
    expect(sdkMocks.pay).toHaveBeenNthCalledWith(1, {
      amount: '3.00',
      to: recipient,
      testnet: true,
      telemetry: false,
    })
  })

  it('付款进行中拒绝重复点击', async () => {
    let resolvePay: ((value: { id: string }) => void) | undefined
    sdkMocks.pay.mockReturnValue(new Promise((resolve) => { resolvePay = resolve }))
    sdkMocks.getPaymentStatus.mockResolvedValue({ status: 'completed' })
    const module = await import('./base-pay')
    module.configureBasePay('3.00')
    await module.preloadBasePaySdk()
    const options = {
      amount: '3.00',
      recipient,
      network: 'base-sepolia' as const,
      onStart: vi.fn(),
      onResult: vi.fn(),
    }
    const first = module.startBasePayPayment(options)
    await expect(module.startBasePayPayment(options)).rejects.toThrow('Base Pay is not ready')
    resolvePay?.({ id: 'payment-2' })
    await first
    expect(sdkMocks.pay).toHaveBeenCalledTimes(1)
  })

  it('轮询失败状态后立即结束', async () => {
    sdkMocks.pay.mockResolvedValue({ id: 'payment-3' })
    sdkMocks.getPaymentStatus.mockResolvedValue({ status: 'failed' })
    const module = await import('./base-pay')
    const onResult = vi.fn()
    module.configureBasePay('3.00')
    await module.preloadBasePaySdk()
    await module.startBasePayPayment({ amount: '3.00', recipient, network: 'base', onStart: vi.fn(), onResult })
    expect(onResult).toHaveBeenCalledWith('failed')
    expect(sdkMocks.getPaymentStatus).toHaveBeenCalledTimes(1)
  })

  it('暂未确认时继续轮询直至完成', async () => {
    vi.useFakeTimers()
    sdkMocks.pay.mockResolvedValue({ id: 'payment-slow' })
    sdkMocks.getPaymentStatus
      .mockResolvedValueOnce({ status: 'pending' })
      .mockResolvedValueOnce({ status: 'not_found' })
      .mockResolvedValueOnce({ status: 'completed' })
    const module = await import('./base-pay')
    const onResult = vi.fn()
    module.configureBasePay('3.00')
    await module.preloadBasePaySdk()
    const payment = module.startBasePayPayment({
      amount: '3.00', recipient, network: 'base-sepolia', onStart: vi.fn(), onResult,
    })
    await vi.runAllTimersAsync()
    await payment
    expect(sdkMocks.getPaymentStatus).toHaveBeenCalledTimes(3)
    expect(onResult).toHaveBeenCalledWith('completed')
  })

  it('三十秒未确认后保留交易并支持重新检查', async () => {
    vi.useFakeTimers()
    sdkMocks.pay.mockResolvedValue({ id: 'payment-timeout' })
    sdkMocks.getPaymentStatus.mockResolvedValue({ status: 'pending' })
    const module = await import('./base-pay')
    const states: Array<{ phase: string; paymentId?: string }> = []
    const onResult = vi.fn()
    module.bindBasePayView((state) => states.push({ phase: state.phase, paymentId: state.paymentId }))
    module.configureBasePay('3.00')
    await module.preloadBasePaySdk()
    const payment = module.startBasePayPayment({
      amount: '3.00', recipient, network: 'base-sepolia', onStart: vi.fn(), onResult,
    })
    await vi.runAllTimersAsync()
    await payment

    expect(sdkMocks.getPaymentStatus).toHaveBeenCalledTimes(20)
    expect(states.at(-1)).toEqual({ phase: 'timeout', paymentId: 'payment-timeout' })
    expect(onResult).toHaveBeenCalledWith('timeout')

    sdkMocks.getPaymentStatus.mockResolvedValue({ status: 'completed' })
    const recheckResult = vi.fn()
    await module.recheckBasePayPayment({ network: 'base-sepolia', onResult: recheckResult })
    expect(recheckResult).toHaveBeenCalledWith('completed')
    expect(sdkMocks.getPaymentStatus).toHaveBeenLastCalledWith(expect.objectContaining({
      id: 'payment-timeout',
      expectedPayment: { amount: '3.00', recipient },
      testnet: true,
      telemetry: false,
    }))
  })

  it('超时后只有显式确认才恢复新支付', async () => {
    vi.useFakeTimers()
    sdkMocks.pay.mockResolvedValue({ id: 'payment-timeout' })
    sdkMocks.getPaymentStatus.mockResolvedValue({ status: 'not_found' })
    const module = await import('./base-pay')
    let phase = ''
    module.bindBasePayView((state) => { phase = state.phase })
    module.configureBasePay('3.00')
    await module.preloadBasePaySdk()
    const payment = module.startBasePayPayment({
      amount: '3.00', recipient, network: 'base', onStart: vi.fn(), onResult: vi.fn(),
    })
    await vi.runAllTimersAsync()
    await payment
    expect(phase).toBe('timeout')
    module.restartBasePayPayment()
    expect(phase).toBe('ready')
  })
})
