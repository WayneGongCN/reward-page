# 赞赏图片加载性能诊断与优化建议

诊断日期：2026-08-20

## 结论

当前瓶颈主要不是图片文件过大，而是请求链路和网络延迟：页面必须依次经历 HTML、入口脚本、`config.json`，随后才会创建二维码图片请求；同时图片和配置均要求浏览器每次重新校验。三张二维码合计只有约 93 KB，继续压缩图片的收益有限。

推荐按以下顺序优化：

1. 将静态配置改为构建期注入，并在初始 HTML 中预加载或直接输出二维码图片，让图片请求不再等待 `config.json`。
2. 为二维码使用内容版本化文件名，并设置一年期 `immutable` 浏览器缓存。
3. 如果主要用户位于中国大陆，增加国内或更稳定跨境线路的静态镜像；仅调整 Vercel 参数无法消除跨境网络延迟。
4. 最后再评估无损图片优化，并以实际扫码成功率作为验收标准。

## 实施状态

2026-08-20 已完成首轮 P0 优化：

- `public/config.json` 在 Vite 启动或构建阶段读取、校验并注入客户端包，不再产生运行时配置请求。
- 构建阶段根据每张图片的 SHA-256 内容生成 12 位 `?v=<hash>` 指纹。
- 初始 HTML 为全部赞赏二维码生成 `preload`，图片下载不再等待客户端渲染。
- Vercel 对 `/assets/*` 返回 `public, max-age=31536000, immutable`。
- 分享图片元信息同步使用内容指纹地址。
- 测试、类型检查和生产构建均已通过。

## 现场数据

本地资源：

| 资源 | 尺寸 | 文件大小 |
| --- | ---: | ---: |
| 微信赞赏码 | 900 × 900 | 30,308 B |
| 支付宝收款码 | 900 × 900 | 54,985 B |
| Buy Me a Coffee | 900 × 900 | 9,090 B |

生产环境多次抽样中，资源均返回 `x-vercel-cache: HIT`，但响应头为：

```text
cache-control: public, max-age=0, must-revalidate
```

当前网络下首页 TTFB 抽样约为 1.0–2.7 秒；单张图片只有 9–55 KB，但仍可能产生约 0.7–1.2 秒的请求等待。该数据说明延迟主要来自网络往返，而非文件传输体积。

当前代码中的关键瀑布链路：

```text
index.html
  -> 哈希 JS/CSS
    -> fetch('/config.json', { cache: 'no-cache' })
      -> 创建三个 <img>
        -> 请求三个二维码
```

## P0：消除配置串行阻塞

`public/config.json` 随每次部署一同发布，不具备无需重新部署即可独立更新的能力，因此运行时请求没有明显收益。建议让 Vite 在构建时读取并校验配置，将结果注入入口模块；保留现有配置文件作为唯一编辑源即可。

更进一步，可让现有 `transformIndexHtml` 插件根据配置生成二维码预加载标签：

```html
<link rel="preload" as="image" href="/assets/wechat-reward-code.v1.jpg">
<link rel="preload" as="image" href="/assets/alipay-reward-code.v1.jpg">
<link rel="preload" as="image" href="/assets/buy-me-a-coffee-reward-code.v1.png">
```

最佳结果是构建时直接输出二维码卡片 HTML，使 HTML 解析阶段即可发现图片；客户端脚本只处理 URL 筛选、埋点和 iframe 高度同步。若希望保持现有纯客户端渲染结构，则“构建期配置 + preload”是改动较小的折中方案。

预期收益：首次访问减少一次阻塞性请求往返，图片下载开始时间明显提前。按本次抽样，理论上可省约 0.2–1.3 秒，实际以浏览器 Performance 面板为准。

## P0：为版本化图片设置长期缓存

当前二维码名称固定，未来覆盖同一路径时会与长期缓存冲突。先将文件名改为带内容哈希或人工版本号，再配置：

```json
{
  "source": "/assets/(.*)",
  "headers": [
    {
      "key": "Cache-Control",
      "value": "public, max-age=31536000, immutable"
    }
  ]
}
```

入口 JS/CSS 已由 Vite 生成哈希文件名，也适合相同策略。分享图同样应版本化。不能在保留固定文件名并可能覆盖内容的情况下直接使用一年期 `immutable`。

如果暂时不愿改文件名，可先使用较短浏览器缓存，例如 `public, max-age=3600`，但回访收益不如版本化资源。

Vercel 官方说明默认 `max-age=0, must-revalidate` 不提供浏览器缓存，并建议内容哈希的不可变静态资源使用一年期缓存：

- https://vercel.com/docs/caching/cache-control-headers
- https://vercel.com/docs/project-configuration/vercel-json#headers

## P1：中国大陆访问路径

当前域名已经是自定义域名，但生产实测即使 CDN 命中仍有约 1 秒以上首包延迟。Vercel 官方明确说明其在中国大陆没有服务器或 CDN 节点，国际出口可能造成延迟、限速或不可访问，并建议有需要时采用静态镜像或双部署：

- https://vercel.com/kb/guide/accessing-vercel-hosted-sites-from-mainland-china

本项目是纯静态站，适合将同一份 `dist` 同步部署到面向中国大陆线路更稳定的静态托管，并按用户区域或备用域名访问。如果选择中国大陆境内部署，还需要处理 ICP 备案和相应合规要求。

不建议未经验证就简单在 Vercel 前增加反向代理；Vercel 官方不推荐在部署前放置代理，且额外代理可能造成缓存、TLS、流量识别和故障排查复杂化。

## P2：图片与加载策略

- 保留 900 × 900 尺寸是合理的：桌面卡片约 300 CSS 像素，能够覆盖高 DPR 屏幕。
- 二维码优先采用无损 PNG、无损 WebP，或保持当前已验证可扫码的 JPEG；不要仅为了体积使用有损 AVIF/WebP。
- 每次转换后至少使用微信、支付宝在不同手机、亮度、屏幕缩放和截图场景进行扫码回归。
- 三张图总计约 93 KB，不建议为此引入 Vercel Image Optimization 或运行时图片转换，额外 URL、缓存和计费复杂度大于收益。
- 如果移动端只展示首张卡片，其余图片可使用 `loading="lazy"`；但当前业务目标是尽快展示所有赞赏方式，且总量很小，继续 `eager` 更合理。
- 可给首张或当前 URL 明确指定的渠道设置 `fetchpriority="high"`，其余保持 `auto`，避免三张图片同时竞争最高优先级。

## 验收建议

部署前后在同一网络和同一设备执行至少五次冷缓存与五次热缓存测试，记录：

- HTML TTFB。
- 第一张二维码请求开始时间。
- 第一张二维码完成时间或 LCP。
- 总请求数和传输量。
- 第二次访问时二维码是否直接来自 memory/disk cache。
- 微信与支付宝扫码成功率。

目标不是单纯降低图片 KB，而是让第一张可扫码二维码尽早出现，并保证回访不再重复走网络校验，喵~
