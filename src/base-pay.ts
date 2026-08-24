import type { PaymentStatus } from '@base-org/account/payment/browser'

export type BasePayNetwork = 'base' | 'base-sepolia'
export type BasePayPhase =
  | 'loading'
  | 'ready'
  | 'awaiting'
  | 'confirming'
  | 'success'
  | 'cancelled'
  | 'failed'
  | 'timeout'
  | 'unavailable'
export type BasePayResult = 'completed' | 'cancelled' | 'failed' | 'timeout'

interface BasePaySdk {
  pay: typeof import('@base-org/account/payment/browser').pay
  getPaymentStatus: typeof import('@base-org/account/payment/browser').getPaymentStatus
}

export interface BasePayState {
  phase: BasePayPhase
  selectedAmount: string
  customAmount: string
  paymentId?: string
  paymentAmount?: string
  recipient?: string
}

interface ResultCallback {
  onResult: (result: BasePayResult) => void
}

interface StartPaymentOptions extends ResultCallback {
  amount: string
  recipient: string
  network: BasePayNetwork
  onStart: () => void
}

interface RecheckPaymentOptions extends ResultCallback {
  network: BasePayNetwork
}

const POLL_INTERVAL_MS = 1_500
const POLL_ATTEMPTS = 20

let sdk: BasePaySdk | undefined
let sdkPromise: Promise<BasePaySdk> | undefined
let listener: ((state: BasePayState) => void) | undefined
let state: BasePayState = {
  phase: 'loading',
  selectedAmount: '',
  customAmount: '',
}

/** 读取经过白名单限制的 Base Pay 构建网络，未知值安全回退测试网，喵~ */
export function getBasePayNetwork(value: string | undefined = import.meta.env.VITE_BASE_PAY_NETWORK): BasePayNetwork {
  return value === 'base' ? 'base' : 'base-sepolia'
}

/** 更新模块级支付状态并同步当前唯一视图，喵~ */
function updateState(patch: Partial<BasePayState>): void {
  state = { ...state, ...patch }
  listener?.(state)
}

/** 为当前 Base Pay 视图绑定模块级状态，语言重渲染时覆盖旧视图，喵~ */
export function bindBasePayView(nextListener: (state: BasePayState) => void): () => void {
  listener = nextListener
  nextListener(state)
  return () => {
    if (listener === nextListener) listener = undefined
  }
}

/** 初始化默认金额，同时保留进行中的付款和已有选择，喵~ */
export function configureBasePay(defaultAmount: string): void {
  if (!state.selectedAmount) updateState({ selectedAmount: defaultAmount })
}

/** 在 Base 卡片接近视口时加载 SDK 独立分包，喵~ */
export function preloadBasePaySdk(): Promise<void> {
  if (!sdkPromise) {
    sdkPromise = import('@base-org/account/payment/browser')
      .then((loadedSdk) => {
        sdk = loadedSdk
        if (state.phase === 'loading' || state.phase === 'unavailable') updateState({ phase: 'ready' })
        return loadedSdk
      })
      .catch((error: unknown) => {
        sdkPromise = undefined
        updateState({ phase: 'unavailable' })
        throw error
      })
  }
  return sdkPromise.then(() => undefined)
}

/** 选择预设金额并清空自定义输入和旧结果，喵~ */
export function selectBasePayAmount(amount: string): void {
  updateState({
    selectedAmount: amount,
    customAmount: '',
    phase: sdk ? 'ready' : 'loading',
    paymentId: undefined,
    paymentAmount: undefined,
    recipient: undefined,
  })
}

/** 保存自定义金额输入并清理已结束的付款状态，喵~ */
export function setBasePayCustomAmount(amount: string): void {
  updateState({
    customAmount: amount,
    phase: sdk ? 'ready' : 'loading',
    paymentId: undefined,
    paymentAmount: undefined,
    recipient: undefined,
  })
}

/** 将 EIP-1193 用户拒绝错误与普通失败区分，喵~ */
function isUserRejection(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const candidate = error as { code?: unknown; error?: { code?: unknown } }
  return candidate.code === 4001 || candidate.error?.code === 4001
}

/** 等待下一次链上状态查询，喵~ */
function waitForNextPoll(): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, POLL_INTERVAL_MS))
}

/** 查询并验证指定交易，网络异常按暂未确认处理，喵~ */
async function readPaymentStatus(
  paymentId: string,
  amount: string,
  recipient: string,
  network: BasePayNetwork,
): Promise<PaymentStatus | undefined> {
  if (!sdk) throw new Error('Base Pay SDK is not ready')
  try {
    return await sdk.getPaymentStatus({
      id: paymentId,
      expectedPayment: {
        amount,
        recipient: recipient as `0x${string}`,
      },
      testnet: network === 'base-sepolia',
      telemetry: false,
    })
  } catch {
    return undefined
  }
}

/** 轮询支付状态并只接受金额与收款地址均匹配的完成结果，喵~ */
async function pollPayment(
  paymentId: string,
  amount: string,
  recipient: string,
  network: BasePayNetwork,
  onResult: ResultCallback['onResult'],
): Promise<void> {
  updateState({ phase: 'confirming', paymentId, paymentAmount: amount, recipient })
  for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt += 1) {
    const paymentStatus = await readPaymentStatus(paymentId, amount, recipient, network)
    if (paymentStatus?.status === 'completed') {
      updateState({ phase: 'success' })
      onResult('completed')
      return
    }
    if (paymentStatus?.status === 'failed') {
      updateState({ phase: 'failed' })
      onResult('failed')
      return
    }
    if (attempt < POLL_ATTEMPTS - 1) await waitForNextPoll()
  }
  updateState({ phase: 'timeout' })
  onResult('timeout')
}

/** 从已预加载的 SDK 直接发起支付，保证调用仍处于点击手势链路，喵~ */
export function startBasePayPayment(options: StartPaymentOptions): Promise<void> {
  if (!sdk || !['ready', 'success', 'cancelled', 'failed'].includes(state.phase)) {
    return Promise.reject(new Error('Base Pay is not ready'))
  }
  options.onStart()
  updateState({
    phase: 'awaiting',
    paymentId: undefined,
    paymentAmount: options.amount,
    recipient: options.recipient,
  })
  const paymentPromise = sdk.pay({
    amount: options.amount,
    to: options.recipient,
    testnet: options.network === 'base-sepolia',
    telemetry: false,
  })
  return paymentPromise
    .then((payment) => pollPayment(
      payment.id,
      options.amount,
      options.recipient,
      options.network,
      options.onResult,
    ))
    .catch((error: unknown) => {
      const result = isUserRejection(error) ? 'cancelled' : 'failed'
      updateState({ phase: result })
      options.onResult(result)
    })
}

/** 对超时交易重新执行相同的受信任状态校验，喵~ */
export function recheckBasePayPayment(options: RecheckPaymentOptions): Promise<void> {
  const { paymentId, paymentAmount, recipient } = state
  if (state.phase !== 'timeout' || !paymentId || !paymentAmount || !recipient) {
    return Promise.reject(new Error('No timed out Base Pay payment'))
  }
  return pollPayment(paymentId, paymentAmount, recipient, options.network, options.onResult)
}

/** 用户确认未扣款后清除超时交易并允许重新支付，喵~ */
export function restartBasePayPayment(): void {
  if (state.phase !== 'timeout') return
  updateState({
    phase: sdk ? 'ready' : 'loading',
    paymentId: undefined,
    paymentAmount: undefined,
    recipient: undefined,
  })
}
