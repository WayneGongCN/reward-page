# 虚拟币赞赏收款方案

更新日期：2026-08-24

## 结论

结合本项目已经提供微信、支付宝和 Buy Me a Coffee，虚拟币渠道主要用于补充海外和加密原生用户。首期建议只增加以下两个渠道：

1. `USDC · Base`：默认推荐。金额接近美元计价，Base 转账成本通常比 Ethereum 主网低，适合小额赞赏。
2. `BTC · Bitcoin`：可选。认知度高，但价格和链上手续费会波动，更适合希望直接持有 BTC 的收款人。

只有在用户确实提出需求后，再考虑：

- `USDT · TRON (TRC20)`：加密用户熟悉，但属于中心化稳定币，发送方和收款方转出时还需理解 TRX/能量费用。
- `USDC · Solana`：转账成本低、速度快，但需要单独的 Solana 地址，且收款方后续转出需要少量 SOL。

不建议首期增加 ETH 主网、小市值代币、Meme 币或隐私币。ETH 主网不适合小额赞赏；其余币种会明显增加价格波动、换汇、合规、钱包兼容性和网络选错风险。

## 方案对比

| 方案 | 金额稳定性 | 小额体验 | 用户认知 | 主要风险 | 建议 |
| --- | --- | --- | --- | --- | --- |
| USDC / Base | 较高，但不是无风险 | 好 | 中等 | 发行方、脱锚、冻结和选错链 | 首选 |
| BTC / Bitcoin | 低 | 一般，手续费随网络变化 | 高 | 币价与手续费波动、地址复用隐私 | 第二选择 |
| USDT / TRON | 较高，但不是无风险 | 较好 | 较高 | 发行方、冻结、TRX/能量费用 | 按需求增加 |
| USDC / Solana | 较高，但不是无风险 | 好 | 中等 | 选错链、需要 SOL 支付后续费用 | Base 的替代项 |
| ETH / Ethereum | 低 | 较差 | 高 | 主网小额转账成本可能不划算 | 不建议首期使用 |

稳定币只降低计价波动，不等于银行存款或法定货币。Circle 的官方列表显示，原生 USDC 同时部署在 Base、Solana 等多条链上；同名资产必须连同网络一起标注，不能只写“USDC”。

## 创建 USDC（Base）收款地址

### 1. 创建专用自托管钱包

使用支持 Base 的可信自托管 EVM 钱包创建一个全新钱包。Base 官方文档列出了 Coinbase Wallet、MetaMask，以及其他兼容 EVM 的钱包。这个钱包只用于公开赞赏，不与日常 DeFi、交易或主要资产钱包混用。

创建后应立即完成以下事项：

- 将助记词离线抄写并保存在安全地点，不截图、不上传云盘、不发送给任何人。
- 不把助记词、私钥、钱包导出文件或 API Token 放进本仓库、Vercel 环境变量或二维码。
- 页面只能公开收款地址；公开地址通常是 `0x...`，可以公开。
- 资产积累到一定额度后，定期转入不公开的冷钱包或硬件钱包。

### 2. 切换到 Base Mainnet

Base 主网参数为：

| 字段 | 值 |
| --- | --- |
| Network Name | Base Mainnet |
| Chain ID | 8453 |
| Currency Symbol | ETH |
| Block Explorer | `https://basescan.org` |

主流 EVM 钱包一般已内置 Base。若需手工添加，以 Base 官方网络文档为准，不从搜索广告复制 RPC 或合约地址。

### 3. 确认原生 USDC

Circle 公布的 Base 主网原生 USDC 合约地址为：

```text
0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
```

这是代币合约地址，不是个人收款地址。收款二维码中应填写钱包自己的 `0x...` 地址，并在页面上明确显示：

```text
资产：USDC
网络：Base Mainnet
地址：0x你的收款地址
仅接受 Base 网络上的原生 USDC
```

收款本身不要求钱包预存 ETH，但以后转出 USDC 时需要少量 Base 网络上的 ETH 支付 Gas。

### 4. 离线生成二维码

当前项目只支持二维码图片。可以在本地生成二维码，避免把公开地址提交给在线二维码网站：

```bash
pnpm dlx qrcode -e H -w 1024 \
  -o public/assets/usdc-base-reward-code.png \
  '0x你的收款地址'
```

二维码暂时使用纯地址兼容更多钱包。页面文字必须同时展示 `USDC` 和 `Base Mainnet`，不能仅依赖图片说明。

### 5. 小额验收

发布前使用另一个钱包按 Base Mainnet 发送最小测试金额，并完成以下检查：

1. 扫码后得到的地址与钱包“接收”页面逐字符一致。
2. 发送资产是 Circle 原生 USDC，不是 `USDC.e` 或其他同名代币。
3. 网络是 Base Mainnet，不是 Ethereum、Arbitrum、Solana 或测试网。
4. 在 BaseScan 上能查到交易，钱包余额正确增加。
5. 再测试一次从收款钱包转出，确认已准备少量 ETH 支付 Gas。

## 创建 BTC 收款地址

1. 从 Bitcoin.org 的钱包选择器中选择可信的自托管钱包，创建一个专用赞赏钱包。
2. 离线备份恢复词，并生成一个新的接收地址；优先使用钱包默认提供的现代地址格式。
3. 使用 BIP-21 URI 生成二维码，例如 `bitcoin:bc1...`，不要预设金额，方便用户自由赞赏。
4. 先发送小额测试交易，再公开二维码。

示例命令：

```bash
pnpm dlx qrcode -e H -w 1024 \
  -o public/assets/bitcoin-reward-code.png \
  'bitcoin:bc1你的收款地址'
```

长期复用一个公开 BTC 地址会让所有入账和余额变化容易被关联。如果需要更好的隐私，应由后端按次生成新地址；不能把扩展私钥或助记词放在前端。Lightning 适合极小额付款，但通常需要 Lightning Address、LNURL 或动态发票服务，不适合直接套用本项目当前的纯静态二维码模型。

## 本项目的接入建议

当前 `public/config.json` 的渠道结构只有 `id` 和 `qrImage`，本地化配置只有名称、替代文本和描述。只增加 USDC 时可以沿用现有模型：

```json
{
  "id": "usdc-base",
  "qrImage": "/assets/usdc-base-reward-code.png"
}
```

中文文案建议：

```json
{
  "name": "USDC · Base",
  "alt": "Wayne 的 Base 网络 USDC 收款二维码",
  "description": "仅接受 Base Mainnet 上的原生 USDC"
}
```

英文文案建议：

```json
{
  "name": "USDC · Base",
  "alt": "Wayne’s USDC receiving QR code on Base",
  "description": "Native USDC on Base Mainnet only"
}
```

更稳妥的后续改造是给渠道模型增加可选的 `asset`、`network`、`address` 和“复制地址”按钮。这样用户即使无法扫码，也能核对并复制地址；页面还可以把币种和网络作为独立字段突出显示。静态站点不需要、也不应该保存任何私钥。

## 安全与运营检查清单

- 使用独立公开收款钱包，不公开主要资产钱包。
- 助记词和私钥只离线保存，任何客服或网站都无权索取。
- 不使用交易所充值地址作为长期公开地址，避免地址变化、Memo/Tag 和平台规则问题。
- 页面同时显示币种、网络、完整地址和选错链警告。
- 首次发布、替换二维码和更换钱包后都执行小额双向测试。
- 保留交易时间、交易哈希、币种、网络和收款时估值记录，便于对账与税务处理。
- 定期转移余额，但转移路径本身仍会在链上公开，不应把“归集”误认为匿名化。
- 对稳定币保留发行方、脱锚、冻结和智能合约风险认知。

## 中国大陆合规提示

中国人民银行等部门发布并由中国政府网公开的通知明确：虚拟货币不具有与法定货币等同的法律地位，虚拟货币相关业务活动属于非法金融活动，境外交易所向境内居民提供服务同样被纳入监管范围。

通知并没有直接回答“个人公开页面被动接受无对价赞赏”的所有具体情形，因此不应据此自行得出一定合法或一定违法的结论。如果站点由中国大陆居民运营，建议上线前向熟悉虚拟货币、互联网服务与个人税务的律师和会计师确认具体模式；不要在页面提供交易、兑换、代买代卖、收益承诺或面向境内用户的交易所导流。

## 官方资料

- [Circle：USDC 官方合约地址](https://developers.circle.com/stablecoins/usdc-contract-addresses)
- [Base：主网参数与钱包设置](https://docs.base.org/base-chain/quickstart/connecting-to-base)
- [Bitcoin.org：选择钱包](https://bitcoin.org/en/choose-your-wallet)
- [Bitcoin BIP-21：付款 URI 标准](https://github.com/bitcoin/bips/blob/master/bip-0021.mediawiki)
- [Tether：支持的网络协议](https://tether.to/en/supported-protocols/)
- [中国政府网：关于进一步防范和处置虚拟货币交易炒作风险的通知](https://www.gov.cn/zhengce/zhengceku/2021-10/08/content_5641404.htm)

