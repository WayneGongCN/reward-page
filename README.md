# Reward Page

一个配置驱动、可独立访问也可嵌入 iframe 的个人赞赏页。页面使用原生 HTML、CSS 和 TypeScript，浏览器端不依赖 UI 框架。

## 功能

- Apple 翻译风格的浅色响应式页面。
- 自动识别浏览器语言，支持简体中文与英文无刷新切换并记忆用户选择。
- 个人信息、双语文案、二维码与社媒元信息统一由 `public/config.json` 管理。
- 支持完整页面和透明紧凑的 iframe 模式。
- 支持按 URL 参数隐藏简介或筛选赞赏渠道。
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
| `channels` | 按展示顺序排列的渠道 ID 和二维码图片 |
| `locales` | `zh-CN` 与 `en` 的标题、简介、界面文案和渠道文案 |

头像、分享图片和二维码必须使用 `/assets/...` 或 `./assets/...` 同源路径。渠道 `id` 只能包含小写字母、数字和连字符，并且不能重复。每种语言必须为全部共享渠道提供对应文案；语言、渠道或必填翻译缺失时开发服务器和生产构建会直接失败。可选的个人资料字段与渠道描述也必须在两种语言中同时提供或同时省略。

构建会根据图片内容自动附加 `?v=<hash>` 指纹；Vercel 对 `/assets/*` 使用一年期不可变缓存。更换图片后无需手工修改版本号，新构建会自动生成新地址。

仓库中的二维码是站点当前使用的公开赞赏素材。调整个人信息或部署域名时需要：

1. 在 `public/config.json` 中更新共享头像，并同步维护 `zh-CN`、`en` 的简介和渠道说明。
2. 将 `meta.canonicalUrl` 改为正式网站地址。
3. 如需更换二维码，将新素材放入 `public/assets/` 并同步修改 `qrImage`。
4. 分享图建议保持 1200×630 PNG 或 JPG 格式。

赞赏码会随公开网站和公开仓库一起发布，不要把任何账号密码、令牌或私密凭据写入 JSON。

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
| `channels` | 逗号分隔的渠道 ID | 仅展示指定渠道；空值隐藏全部渠道 |

示例：

```text
/?mode=embed&intro=0&channels=wechat,alipay
```

未知渠道会被忽略，最终顺序始终由 JSON 配置决定。URL 参数不能选择其他配置文件。
语言不属于 URL 参数协议，由浏览器偏好和页面切换器控制。

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

必须同时校验 `event.origin` 和 `event.source`。页面不接收父窗口消息，也不会通过消息传递配置或个人内容。

## Google Analytics 4

实现使用官方 Google Tag，并沿用以下隐私边界：

- 允许 `analytics_storage`。
- 拒绝广告存储、广告用户数据和广告个性化。
- 关闭 Google Signals 与广告个性化信号。
- 不设置用户 ID，不发送二维码内容、简介、完整 URL 或异常原文。
- 自动发送 `page_view`，并发送 `reward_page_view` 与匿名的 `reward_config_error`。

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

Preview 与 Development 环境不要设置 `VITE_GA_MEASUREMENT_ID`；`VITE_TELEMETRY_ENABLED` 未设置或不为 `true` 时不会加载 GA。

发布规则：

- Pull Request：GitHub Actions 执行测试、类型检查和构建，Vercel 创建 Preview Deployment。
- 推送 `main`：GitHub Actions 执行质量门禁，Vercel 自动创建 Production Deployment 并更新 `reward.waynegong.cn`。
- 其他分支推送：Vercel 创建 Preview Deployment。

GitHub Actions 与 Vercel Git 部署彼此独立触发；需要强制“质量门禁通过后才能生产部署”时，应启用 `main` 分支保护并要求“测试、类型检查与构建”检查通过后才能合并。

回滚优先在 Vercel Deployments 中选择上一份正常的 Production Deployment 并执行 Promote to Production。

## 安全响应头

`vercel.json` 配置 CSP、Referrer Policy、MIME 嗅探保护和权限限制。为了允许跨站 iframe，项目不会发送 `X-Frame-Options`，CSP 使用 `frame-ancestors *`；接入方应自行限制允许嵌入赞赏页的页面范围。

## License

[MIT](./LICENSE)
