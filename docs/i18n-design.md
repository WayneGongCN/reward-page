# 赞赏页多语言设计

## 目标与边界

首期支持简体中文 `zh-CN` 与英文 `en`。页面不引入 i18n 运行时依赖，不增加语言 URL 参数，不改变 `mode`、`intro`、`channels` 和 iframe 高度消息协议。语言选择只依赖用户本地选择和浏览器语言，不使用地理位置、IP、Cookie 或父页面消息。

## 配置模型

`public/config.json` 将稳定结构与本地化内容分开：

- `meta`、`profile` 和 `channels` 保存规范地址、图片与渠道 ID 等共享数据。
- `locales.zh-CN` 和 `locales.en` 保存页面元信息、个人资料、界面文案、渠道名称、说明和图片替代文本。
- `defaultLocale` 决定无匹配语言时的回退值，固定为 `zh-CN`。
- `socialLocale` 决定构建期 HTML 与分享抓取器看到的内容，固定为 `en`。

构建校验要求两种语言完整存在、本地化渠道 ID 与共享渠道严格相等，并要求简介、个人资料可选字段及渠道描述在两种语言中的存在性一致。配置头像时，两种语言都必须提供 `avatarAlt`。任一规则失败都会终止开发服务器启动或生产构建，不进行跨语言文案回退。

新增渠道时，需要先在共享 `channels` 中增加 ID 与二维码，再在两个语言节点中分别增加同 ID 文案。更换图片只修改共享路径，构建会继续生成内容指纹。

## 语言选择与切换

启动顺序为：

1. 尝试读取 `localStorage["reward-page:locale"]`。
2. 依次匹配 `navigator.languages`；`zh-*` 映射为 `zh-CN`，`en-*` 映射为 `en`。
3. 回退到 `defaultLocale`。

存储读写被异常保护，隐私模式或浏览器限制不会阻断渲染。用户点击页面顶部的双选项切换器后，页面立即重新解析本地化配置并重渲染，同时更新 `document.title`、description、OG、Twitter、图片替代文本和 `<html lang>`。iframe 继续由现有 `ResizeObserver` 上报高度变化。

## SEO、可访问性与统计

Vite 使用 `socialLocale` 生成初始 `<html lang>`、Loading 标签、标题、description、OG 和 Twitter 元信息，因此不执行 JavaScript 的分享抓取器始终看到英文。规范地址不随语言变化，也不输出指向同一 URL 的 `hreflang`。

切换器使用语言自称“简体中文”和“English”，通过本地化 `aria-label` 描述控件，并以 `aria-pressed` 暴露当前状态。头像与二维码均使用显式配置的本地化替代文本。

GA 初始化发生在首次语言和元信息确定之后。`reward_page_view` 携带 `content_language`，手动切换发送只包含前后语言的 `reward_language_change`；不发送简介、完整 URL 或其他个人内容。

## 验收要求

- 双语配置校验、语言匹配、存储异常和解析回退具有单元测试。
- 完整模式、嵌入模式、简介显隐、渠道筛选、空渠道、图片失败和致命错误具有双语行为覆盖。
- 生产构建的初始 HTML 固定为英文，运行时切换可同步正文与元信息。
- `pnpm test`、`pnpm typecheck`、`pnpm build` 全部通过，并完成桌面和移动尺寸视觉检查，喵~
