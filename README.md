# Reward Page

一个配置驱动、可独立访问也可嵌入 iframe 的个人赞赏页。页面使用原生 HTML、CSS 和 TypeScript，浏览器端不依赖 UI 框架。

## 功能

- Apple 翻译风格的浅色响应式页面。
- 自动识别浏览器语言，支持简体中文与英文无刷新切换并记忆用户选择。
- 个人信息、双语文案、二维码与社媒元信息统一由 `public/config.json` 管理。
- 支持完整页面和透明紧凑的 iframe 模式。
- 支持按 URL 参数隐藏简介或筛选赞赏渠道。
- 二维码渠道可选展示并复制公开钱包地址。
- Base 渠道支持 Base Pay 的 USDC 快捷金额、自定义金额和链上确认状态。
- 基于 GitHub Issues 的公开留言 Tab，首次切换时才加载评论组件。
- iframe 内容高度变化时通过 `postMessage` 通知父页面。
- 可选 GA4 匿名访问统计，仅在 Vercel Production 发布时启用。
- GitHub Actions 质量门禁与 Vercel Git 自动部署。

## 本地开发

需要 Node.js 22 和 pnpm 10.12.1。

```bash
pnpm install
pnpm dev
```

常用命令：

```bash
pnpm test
pnpm typecheck
pnpm build
pnpm preview
```

Vite 会在启动和构建时校验并注入静态配置，同时为图片地址生成内容指纹。修改配置后，开发服务器会自动重启并应用新内容。页面需要由本地开发服务器或静态服务器提供，不能直接使用 `file://` 打开 `index.html`。

## 内容配置

编辑 `public/config.json`：

| 字段 | 说明 |
| --- | --- |
| `defaultLocale` | 浏览器没有可匹配语言时使用的默认语言，当前为 `zh-CN` |
| `socialLocale` | 构建期 HTML 和社交分享预览使用的语言，当前为 `en` |
| `meta` | 两种语言共享的规范地址和分享图片 |
| `profile` | 两种语言共享的可选头像 |
| `comments` | utterances 使用的公开 GitHub 仓库与 Issue 标签 |
| `channels` | 按展示顺序排列的渠道 ID、二维码图片和可选公开复制值 |
| `locales` | `zh-CN` 与 `en` 的标题、简介、界面文案和渠道文案 |

头像、分享图片和二维码必须使用 `/assets/...` 或 `./assets/...` 同源路径。渠道 `id` 只能包含小写字母、数字和连字符，并且不能重复。渠道可通过可选的 `copyValue` 配置需要展示和复制的公开文本；配置后不能为空。每种语言必须为全部共享渠道提供对应文案；语言、渠道或必填翻译缺失时开发服务器和生产构建会直接失败。可选的个人资料字段与渠道描述也必须在两种语言中同时提供或同时省略。

构建会根据图片内容自动附加 `?v=<hash>` 指纹；Vercel 对 `/assets/*` 使用一年期不可变缓存。更换图片后无需手工修改版本号，新构建会自动生成新地址。

仓库中的二维码是站点当前使用的公开赞赏素材。调整个人信息或部署域名时需要：

1. 在 `public/config.json` 中更新共享头像，并同步维护 `zh-CN`、`en` 的简介和渠道说明。
2. 将 `meta.canonicalUrl` 改为正式网站地址。
3. 如需更换二维码，将新素材放入 `public/assets/` 并同步修改 `qrImage`。
4. 分享图建议保持 1200×630 PNG 或 JPG 格式。

赞赏码会随公开网站和公开仓库一起发布，不要把任何账号密码、令牌或私密凭据写入 JSON。

### 虚拟币钱包渠道

生产配置当前已启用 `base` 渠道，用于接收 Base 网络上的 USDC。该渠道通过可选的 `basePay` 配置启用 Base Pay，`copyValue` 同时作为 Base Pay 收款地址；启用时必须是 `0x` 加 40 位十六进制字符。金额配置示例：

```json
{
  "id": "base",
  "qrImage": "/assets/base-reward-code.png",
  "copyValue": "0xEF787423A25713C0c979d4F5323FB05b2C2b5D38",
  "basePay": {
    "presetAmounts": ["1.00", "3.00", "5.00"],
    "defaultAmount": "3.00",
    "customMin": "0.10",
    "customMax": "100.00"
  }
}
```

金额必须是正数十进制字符串且最多两位小数。预设值必须唯一、严格升序并位于自定义范围内，默认值必须属于预设值。页面内部使用整数美分比较，调用 SDK 时仍传递规范化的十进制字符串。

Base Pay SDK 会在卡片进入视口前约 300px 时按需加载为独立分包。主网默认将原有二维码、完整地址和复制按钮折叠为“使用其他钱包”；SDK 加载失败时自动展开。测试网会显示醒目提示并隐藏这组主网二维码，防止误用真实资产。收款页不连接收款钱包、不保存私钥、不请求付款人身份，也不在站内创建订单。

BTC、USDT 与其他赞赏方式使用相同的二维码渠道模型，不引入链上 SDK 或地址格式判断。真实素材到位后，可在共享渠道末尾追加：

```json
{
  "id": "btc",
  "qrImage": "/assets/btc-reward-code.png",
  "copyValue": "<BTC_ADDRESS>"
},
{
  "id": "usdt",
  "qrImage": "/assets/usdt-reward-code.png",
  "copyValue": "<USDT_ADDRESS>"
}
```

同时需要在 `zh-CN`、`en` 的 `channels` 中补充同 ID 的名称、图片替代文本和说明。币种链或网络属于运营说明，不参与前端逻辑；正式发布前必须确认二维码解析值、`copyValue` 和钱包收款页完全一致。占位符不能写入生产配置，也不能发布看起来可付款但实际无效的二维码。

钱包地址会作为页面正文公开展示。这里只能填写公开收款地址，严禁填写私钥、助记词、交易所 API 密钥、密码或其他凭据。

## 多语言

页面按以下顺序选择显示语言：

1. `localStorage` 中键名为 `reward-page:locale` 的有效用户选择。
2. `navigator.languages` 中首个可匹配的语言；所有 `zh-*` 映射到 `zh-CN`，所有 `en-*` 映射到 `en`。
3. 配置中的 `defaultLocale`。

页面顶部的“简体中文 / English”切换器会无刷新更新正文、图片替代文本、错误态、`<html lang>` 和运行时元信息。存储不可用时切换仍然生效，但刷新后会重新按浏览器偏好选择。

语言不会写入 URL，也不会读取 IP、地理位置、Cookie 或父页面消息。同一规范地址只有一套可被爬虫稳定读取的分享预览；当前由 `socialLocale: "en"` 固定为英文。浏览器运行页面后，标题和元信息仍会随用户语言切换。由于两种语言没有独立 URL，页面不生成 `hreflang`。

## URL 参数

| 参数 | 取值 | 行为 |
| --- | --- | --- |
| `mode` | `full` / `embed` | 默认 `full`；`embed` 使用透明紧凑样式并默认隐藏简介 |
| `intro` | `1` / `0` | 覆盖模式默认值，控制个人信息区 |
| `comments` | `1` / `0` | 控制留言 Tab 入口；`full` 默认开启，`embed` 默认关闭 |
| `channels` | 逗号分隔的渠道 ID | 仅展示指定渠道；空值隐藏全部渠道 |

示例：

```text
/?mode=embed&intro=0&comments=1&channels=wechat,alipay
```

未知渠道会被忽略，最终顺序始终由 JSON 配置决定。URL 参数不能选择其他配置文件。
语言不属于 URL 参数协议，由浏览器偏好和页面切换器控制。

## GitHub Issues 评论

评论区使用 [utterances](https://utteranc.es/)，评论数据公开存储在 `WayneGongCN/reward-page` 的 GitHub Issues 中。完整页默认显示“赞赏 / 留言”双 Tab 并停留在赞赏内容；只有首次切到留言 Tab 时才加载 utterances，切回赞赏不会重复加载。页面按 `pathname` 查找 Issue，因此语言、`mode`、`intro`、`comments` 和 `channels` 等查询参数不会创建不同的评论线程；首次发表评论时 utterances 会自动创建对应 Issue。

仓库侧首次启用步骤：

1. 在 GitHub 仓库创建区分大小写的 `comments` 标签。
2. 确认仓库为公开仓库且 Issues 已启用。
3. 先将根目录的 `utterances.json` 合入默认分支；当前仅允许 `https://reward.waynegong.com` 提交评论。
4. 安装 [utterances GitHub App](https://github.com/apps/utterances)，并仅授权 `WayneGongCN/reward-page`。

评论者必须登录并授权 GitHub，首期不支持匿名评论。utterances 内部编辑器使用英文，本站只负责评论标题、公开性说明、加载状态和错误态的中英文切换。本地与 Vercel Preview 可以加载评论，但会因来源限制而无法提交。

前端不保存 GitHub OAuth Client Secret、访问令牌、评论内容或用户身份。第三方脚本加载失败时只在留言 Tab 显示错误态，不会阻断赞赏渠道；留言面板显示时的评论 iframe 高度变化会被现有页面尺寸监听捕获。

## iframe 接入

页面加载、图片完成和内容尺寸变化时会向父窗口发送：

```ts
interface RewardPageResizeMessage {
  type: 'appreciation-page:resize'
  version: 1
  height: number
}
```

父页面示例：

```html
<iframe
  src="https://your-reward-page.example.com/?mode=embed"
  allow="clipboard-write"
  title="赞赏方式"
></iframe>
```

```ts
const frame = document.querySelector<HTMLIFrameElement>('#reward-page')
const rewardPageOrigin = 'https://your-reward-page.example.com'

window.addEventListener('message', (event) => {
  if (event.origin !== rewardPageOrigin || event.source !== frame?.contentWindow) return
  if (event.data?.type !== 'appreciation-page:resize' || event.data?.version !== 1) return
  if (!Number.isFinite(event.data.height) || event.data.height < 0) return
  frame.style.height = `${Math.ceil(event.data.height)}px`
})
```

必须同时校验 `event.origin` 和 `event.source`。页面不接收父窗口消息，也不会通过消息传递配置或个人内容。跨域 iframe 需要由父页面通过 `allow="clipboard-write"` 授权现代剪贴板能力；未授权或浏览器拒绝时，页面会尝试兼容性复制，并保留可手动选择的完整地址。

当前示例未设置 `sandbox`，Base Pay 可以正常打开付款弹窗。宿主若自行添加 `sandbox`，必须至少允许弹窗，例如加入 `allow-popups`；否则浏览器会阻止 Base Pay。不要在赞赏页响应头设置 `Cross-Origin-Opener-Policy: same-origin`，该策略会破坏 Coinbase 弹窗与原页面之间的通信。

## Base Pay 网络配置

公开构建变量只接受以下语义：

```text
VITE_BASE_PAY_NETWORK=base-sepolia
```

- 缺省、Development 和 Preview 使用 `base-sepolia`。
- Vercel Production 必须显式设置为 `base`。
- 其他值会安全回退到 `base-sepolia`。

该变量会写入公开构建产物，不是秘密。Base Pay 使用 `@base-org/account@2.5.10` 的 `pay()` 与 `getPaymentStatus()`；两处遥测都固定关闭。页面每 1.5 秒校验一次受信任的金额和收款地址，最多 20 次。超时后保留付款 ID 并提示不要重复付款，用户可重新检查，或确认未扣款后开始新支付。

## Google Analytics 4

实现使用官方 Google Tag，并沿用以下隐私边界：

- 允许 `analytics_storage`。
- 拒绝广告存储、广告用户数据和广告个性化。
- 关闭 Google Signals 与广告个性化信号。
- 不设置用户 ID，不发送二维码内容、简介、完整 URL 或异常原文。
- 自动发送 `page_view`，并发送 `reward_page_view` 与匿名的 `reward_config_error`；页面浏览事件只附带留言 Tab 是否可用，不包含评论内容、Issue 编号或 GitHub 身份。
- Base Pay 仅发送 `reward_base_pay_start` 和 `reward_base_pay_result`；参数只包含当前语言及 `completed | cancelled | failed | timeout` 结果，不发送金额、地址、交易标识、异常原文或付款人信息。

环境变量：

```text
VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX
VITE_TELEMETRY_ENABLED=false
```

本地与 Preview 默认关闭遥测。Vercel Production 环境设置 `VITE_TELEMETRY_ENABLED=true`，并从同一环境读取 `VITE_GA_MEASUREMENT_ID`。`VITE_*` 会写入公开构建产物，不能存放秘密。

## Vercel 部署

Vercel 项目名称为 `reward-page`，并连接 GitHub 仓库 `WayneGongCN/reward-page`。本地首次开发时可通过 CLI 关联：

```bash
pnpm dlx vercel link --project reward-page
```

部署由 Vercel Git 集成完成，不需要在 GitHub 配置 Vercel Token 或项目 ID。请在 Vercel 项目的 Production 环境配置：

- `VITE_TELEMETRY_ENABLED=true`
- `VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX`
- `VITE_BASE_PAY_NETWORK=base`

Preview 与 Development 环境不要设置 `VITE_GA_MEASUREMENT_ID`；`VITE_TELEMETRY_ENABLED` 未设置或不为 `true` 时不会加载 GA。Preview 与 Development 的 `VITE_BASE_PAY_NETWORK` 保持 `base-sepolia`，不要复用 Production 的主网值。

发布规则：

- Pull Request：GitHub Actions 执行测试、类型检查和构建，Vercel 创建 Preview Deployment。
- 推送 `main`：GitHub Actions 执行质量门禁，Vercel 自动创建 Production Deployment 并更新 `reward.waynegong.com`。
- 其他分支推送：Vercel 创建 Preview Deployment。

GitHub Actions 与 Vercel Git 部署彼此独立触发；需要强制“质量门禁通过后才能生产部署”时，应启用 `main` 分支保护并要求“测试、类型检查与构建”检查通过后才能合并。

回滚优先在 Vercel Deployments 中选择上一份正常的 Production Deployment 并执行 Promote to Production。

## 安全响应头

`vercel.json` 配置 CSP、Referrer Policy、MIME 嗅探保护和权限限制。CSP 为 utterances 增加 `https://utteranc.es` 的脚本与 iframe 来源，并只为 Base Pay 状态查询增加 `https://chain-proxy.wallet.coinbase.com`；没有新增连接通配符。由于评论组件会注入样式并动态调整高度，`style-src` 显式允许内联样式。为了允许跨站 iframe，项目不会发送 `X-Frame-Options`，CSP 使用 `frame-ancestors *`；接入方应自行限制允许嵌入赞赏页的页面范围。项目也不会设置 `Cross-Origin-Opener-Policy: same-origin`。

## License

[MIT](./LICENSE)
