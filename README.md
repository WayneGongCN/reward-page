# Reward Page

一个配置驱动、可独立访问也可嵌入 iframe 的个人赞赏页。页面使用原生 HTML、CSS 和 TypeScript，浏览器端不依赖 UI 框架。

## 功能

- Apple 翻译风格的浅色响应式页面。
- 个人信息、界面文案、二维码与社媒元信息统一由 `public/config.json` 管理。
- 支持完整页面和透明紧凑的 iframe 模式。
- 支持按 URL 参数隐藏简介或筛选赞赏渠道。
- iframe 内容高度变化时通过 `postMessage` 通知父页面。
- 可选 GA4 匿名访问统计，仅在 Vercel Production 发布时启用。
- GitHub Actions 质量门禁、Vercel Preview 和 Tag 生产发布。

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

页面通过 `fetch` 读取静态配置，不能直接使用 `file://` 打开 `index.html`。

## 内容配置

编辑 `public/config.json`：

| 字段 | 说明 |
| --- | --- |
| `meta` | 页面标题、描述、规范地址和分享图片 |
| `profile` | 可选头像、姓名、身份说明和简介段落 |
| `ui` | 渠道标题、错误/空状态和隐私说明文案 |
| `channels` | 按展示顺序排列的赞赏渠道 |

头像、分享图片和二维码必须使用 `/assets/...` 或 `./assets/...` 同源路径。渠道 `id` 只能包含小写字母、数字和连字符，并且不能重复。

仓库中的二维码全部是不可支付的示例图。上线前至少需要：

1. 将真实二维码放入 `public/assets/`，并修改各渠道的 `qrImage`。
2. 替换示例头像、简介和渠道说明。
3. 将 `meta.canonicalUrl` 改为正式网站地址。
4. 将 `meta.shareImage` 替换为正式的 1200×630 PNG 或 JPG 分享图。

赞赏码会随公开网站和公开仓库一起发布，不要把任何账号密码、令牌或私密凭据写入 JSON。

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

本地与 Preview 固定关闭遥测。Production 工作流显式设置 `VITE_TELEMETRY_ENABLED=true`，并从 Vercel Production 环境读取 `VITE_GA_MEASUREMENT_ID`。`VITE_*` 会写入公开构建产物，不能存放秘密。

## Vercel 部署

先创建 Vercel 项目，并通过 CLI 在本地关联一次：

```bash
pnpm dlx vercel link
```

将 `.vercel/project.json` 中的 `orgId`、`projectId` 以及 Vercel Access Token 配置为 GitHub Repository Secrets：

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

在 Vercel 项目的 Production 环境配置 `VITE_GA_MEASUREMENT_ID`。Preview 环境无需配置 GA。

发布规则：

- Pull Request 和 `main` 推送：运行测试、类型检查和构建。
- `main` 推送：质量门禁通过后创建 Vercel Preview；若尚未配置 Secrets，则安全跳过部署并在任务摘要中说明。
- 版本 Tag：确认对应提交属于 `main` 后部署 Production，并启用 GA。

生产发布示例：

```bash
git tag v0.1.0
git push origin v0.1.0
```

回滚优先在 Vercel Deployments 中选择上一份正常的 Production Deployment。不要移动已经发布的 Tag；需要重新构建旧版本时，在目标提交上创建新的修复版本 Tag。

## 安全响应头

`vercel.json` 配置 CSP、Referrer Policy、MIME 嗅探保护和权限限制。为了允许跨站 iframe，项目不会发送 `X-Frame-Options`，CSP 使用 `frame-ancestors *`；接入方应自行限制允许嵌入赞赏页的页面范围。

## License

[MIT](./LICENSE)
