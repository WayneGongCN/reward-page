# Base Pay 接入设计与验收记录

## 目标与边界

`USDC · Base` 渠道将 Base Pay 作为首选入口，同时保留现有二维码和公开地址给 Trust Wallet、MetaMask 等钱包使用。站点继续保持纯静态 Vite 架构，不增加后端、账号系统、订单数据库或收款钱包连接；收款地址仅是公开的 `0xEF787423A25713C0c979d4F5323FB05b2C2b5D38`，项目不持有私钥。

Base Pay 只请求付款，不请求 `payerInfo`。SDK 自带遥测在发起支付和查询状态时均关闭。现有 GA4 只记录开始、受限结果和当前页面语言，不记录金额、地址、交易标识、异常原文或付款人资料。

## 配置模型

共享渠道可选增加 `basePay`，其 `presetAmounts`、`defaultAmount`、`customMin` 和 `customMax` 都使用最多两位小数的正数字符串。解析阶段将金额转换为整数美分完成唯一性、升序、成员关系和范围校验，再统一为两位小数字符串供 SDK 使用。

存在 `basePay` 时，`copyValue` 是同一个 Base Pay 收款地址，必须符合 `0x` 加 40 位十六进制字符。应用最多允许一个 Base Pay 渠道，避免模块级支付状态映射到多个视图。所有支付交互文案在 `zh-CN` 与 `en` 中都属于必填配置。

## 加载与支付状态

浏览器只在 Base 渠道实际展示时建立 300px 提前量的 `IntersectionObserver`。触发后动态导入 `@base-org/account/payment/browser`，因此 SDK 形成独立异步分包；支付按钮必须等 SDK 就绪后才启用。点击处理函数不会再执行动态导入，`pay()` 直接位于用户点击调用栈中，以保留浏览器弹窗权限。

支付状态保存在模块内，包括当前阶段、预设或自定义金额、付款 ID、付款金额和收款地址。语言切换触发 DOM 重建时会重新绑定视图，但不会清空这份状态。页面刷新会清空状态，也不会把状态上传或写入持久化存储。

状态流程如下：

1. 调用 `pay()`，固定传入金额、收款地址、主网或测试网标记以及 `telemetry: false`。
2. 获得付款 ID 后进入确认态，每 1.5 秒调用 `getPaymentStatus()`。
3. 查询固定携带 `expectedPayment: { amount, recipient }`、同一网络和 `telemetry: false`。
4. `completed` 显示成功；`failed` 显示失败；用户拒绝错误显示取消；`pending`、`not_found` 和暂时的查询异常继续轮询。
5. 最多查询 20 次。约 30 秒仍未确认时保留付款 ID并阻止直接重复付款，提供重新检查和“确认未扣款后重新支付”两个显式操作。

## 网络与备用入口

`VITE_BASE_PAY_NETWORK` 只有值为 `base` 时使用主网，其他情况全部回退 `base-sepolia`。Production 需要在 Vercel 显式设置 `base`；Preview、本地和缺省构建保持测试网。

主网下的备用钱包区默认折叠，展开后才创建二维码图片、地址和复制按钮。SDK 加载失败会自动展开。测试网模式显示提示并完全不渲染主网备用区，避免用户把真实主网资产发到测试流程。

## 安全与嵌入

CSP 的 `connect-src` 只增加 `https://chain-proxy.wallet.coinbase.com`，不增加通配符。项目不设置 `Cross-Origin-Opener-Policy: same-origin`。赞赏页放入 iframe 时，宿主不使用 `sandbox` 可维持现状；宿主自行增加 `sandbox` 时必须允许弹窗，否则 Base Pay 无法打开。折叠区和支付状态引发的高度变化继续由页面现有 `ResizeObserver` 协议上报。

## 自动化与人工验收

自动化测试覆盖金额工具、配置约束、SDK 预加载时机、主网和测试网参数、预期付款校验、完成、取消、失败、重复点击、超时、重新检查、重新支付、语言切换恢复、二维码懒渲染、测试网隐藏备用区、渠道过滤不加载 SDK、SDK 故障隔离、GA 隐私边界和 CSP 白名单。

合入前执行：

```bash
pnpm test
pnpm typecheck
pnpm build
```

人工先在 Base Sepolia 验证取消、成功、慢确认和弹窗拦截；Production 配置主网后再使用 `0.10 USDC` 小额验证收款地址的 Base USDC 余额、实际金额和备用二维码。人工链上付款不属于自动化测试，必须在发布前由维护者完成。
