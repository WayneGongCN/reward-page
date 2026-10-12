# GitHub Issues 评论系统设计

## 目标与选型

赞赏页使用 utterances 接入公开评论，数据存储在 `WayneGongCN/reward-page` 的 GitHub Issues。该方案无需自建后端、数据库或 OAuth Client Secret，并保持当前原生 TypeScript 与静态部署架构。

本次严格要求使用 GitHub Issues，因此不采用基于 GitHub Discussions 的 giscus。Gitalk 需要自行维护 OAuth 应用、Client Secret 交换代理和更多运行时依赖，也不符合当前纯静态站的安全边界。

## 配置与页面协议

共享配置新增：

```json
{
  "comments": {
    "repository": "WayneGongCN/reward-page",
    "label": "comments"
  }
}
```

构建期校验仓库名符合 `owner/repo` 格式，并要求标签为非空字符串。评论标题、GitHub 登录与公开性说明、加载状态和失败文案分别在 `zh-CN` 与 `en` 的 `ui` 中维护。

URL 参数 `comments=1|0` 控制留言 Tab 入口：

- `full` 模式默认开启，`comments=0` 可关闭。
- `embed` 模式默认关闭，`comments=1` 可开启。
- 空值和其他非法值回退到模式默认值。

utterances 固定使用 `issue-term="pathname"`。查询参数和语言选择不会参与映射，因此同一路径始终复用同一个 Issue。

## 渲染、性能与失败边界

页面在评论功能启用时展示“赞赏 / 留言”双 Tab，并默认停留在赞赏面板。留言面板首次激活时，独立加载模块才创建 `https://utteranc.es/client.js` 异步脚本，并设置公开仓库、`comments` 标签、`pathname` 映射、`github-light` 主题及匿名跨域属性；切回赞赏只隐藏留言面板，不销毁已经加载的 widget。

语言切换会保留当前 Tab；若当前为留言，页面使用新语言重新创建评论外层和 widget，Issue 映射保持不变，授权会话仍由 utterances 管理。utterances 内部编辑器当前为英文，本站只本地化 Tab、标题和外层界面。

脚本网络失败时，评论区显示本地化错误态并移除失败脚本，赞赏渠道继续可用。评论内容增减会改变文档高度，现有 `ResizeObserver` 会继续向外层宿主页发送 `appreciation-page:resize` 消息。

## 安全、隐私与仓库运维

CSP 为 utterances 增加以下能力：

- `script-src` 允许 `https://utteranc.es`。
- `frame-src` 允许 `https://utteranc.es`。
- `style-src` 允许 `unsafe-inline`，满足官方脚本注入样式和动态高度的要求。

其他 CSP 指令保持不变。该内联样式放宽是直接在主页面集成官方脚本的已确认安全折中。

根目录 `utterances.json` 仅允许 `https://reward.waynegong.com` 提交评论。本地和 Vercel Preview 可以加载已有评论，但不能发评论。仓库必须保持公开并启用 Issues；需要预先创建 `comments` 标签，先将来源限制合入默认分支，再将 utterances GitHub App 仅授权给当前仓库。

评论者必须登录 GitHub，评论和 GitHub 身份均公开。本站不保存 GitHub 令牌、OAuth Client Secret、评论正文或 Issue 编号。GA 的 `reward_page_view` 只增加匿名布尔字段 `comments_visible`。

## 验收标准

- full/embed 的留言 Tab 默认值与 `comments=1|0` 覆盖行为正确。
- 默认赞赏面板不加载第三方脚本，首次切到留言才创建 utterances widget。
- Tab 支持点击和左右方向键，中英文切换保留当前 Tab，任一时刻只有一个 widget。
- 不同查询参数与语言共享同一个 pathname Issue。
- 第三方脚本失败不影响赞赏页主体。
- GitHub OAuth 登录后可发表评论，自动创建的 Issue 带有 `comments` 标签。
- 嵌入模式显式开启评论后，评论增高不会被内外层 iframe 截断。
- 单元测试、类型检查和生产构建全部通过。
