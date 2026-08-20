import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import { parseAppConfig } from './src/config'
import type { AppConfig } from './src/types'

const configPath = fileURLToPath(new URL('./public/config.json', import.meta.url))

/** 转义写入 HTML 文本与属性的配置内容，喵~ */
function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

/** 将相对分享图片路径转换为抓取器可访问的绝对地址，喵~ */
function resolveShareImage(canonicalUrl: string, shareImage: string): string {
  return new URL(shareImage, canonicalUrl).toString()
}

/** 为公开静态资源附加内容指纹，确保长期缓存后仍能在内容变化时更新，喵~ */
function fingerprintAsset(assetPath: string): string {
  const assetUrl = new URL(assetPath, 'https://reward-page.local/')
  const relativePath = decodeURIComponent(assetUrl.pathname).replace(/^\/+/, '')
  const filePath = fileURLToPath(new URL(`./public/${relativePath}`, import.meta.url))
  const fingerprint = createHash('sha256').update(readFileSync(filePath)).digest('hex').slice(0, 12)
  assetUrl.searchParams.set('v', fingerprint)
  return `${assetUrl.pathname}${assetUrl.search}${assetUrl.hash}`
}

/** 为配置中的全部展示图片生成稳定的缓存破坏地址，喵~ */
function fingerprintConfig(config: AppConfig): AppConfig {
  return {
    ...config,
    meta: {
      ...config.meta,
      shareImage: fingerprintAsset(config.meta.shareImage),
    },
    profile: config.profile
      ? {
          ...config.profile,
          avatar: config.profile.avatar ? fingerprintAsset(config.profile.avatar) : undefined,
        }
      : undefined,
    channels: config.channels.map((channel) => ({
      ...channel,
      qrImage: fingerprintAsset(channel.qrImage),
    })),
  }
}

/** 从公开配置生成开发与生产环境共用的社媒元信息，喵~ */
function configDrivenMetadata(config: AppConfig): Plugin {
  return {
    name: 'reward-page-config-driven-metadata',
    configureServer(server) {
      server.watcher.add(configPath)
    },
    handleHotUpdate(context) {
      if (context.file !== configPath) return
      void context.server.restart()
      return []
    },
    transformIndexHtml(html) {
      const replacements: Record<string, string> = {
        __META_TITLE__: config.meta.title,
        __META_DESCRIPTION__: config.meta.description,
        __META_CANONICAL_URL__: config.meta.canonicalUrl,
        __META_SHARE_IMAGE__: resolveShareImage(config.meta.canonicalUrl, config.meta.shareImage),
      }

      const metadataHtml = Object.entries(replacements).reduce(
        (output, [token, value]) => output.replaceAll(token, escapeHtml(value)),
        html,
      )
      const preloadLinks = config.channels
        .map((channel) => `<link rel="preload" as="image" href="${escapeHtml(channel.qrImage)}" />`)
        .join('\n    ')
      return metadataHtml.replace('</head>', `  ${preloadLinks}\n  </head>`)
    },
  }
}

/** 创建个人赞赏页的 Vite 配置，喵~ */
export default defineConfig(() => {
  const sourceConfig = parseAppConfig(JSON.parse(readFileSync(configPath, 'utf8')))
  const appConfig = fingerprintConfig(sourceConfig)

  return {
    plugins: [configDrivenMetadata(appConfig)],
    define: {
      __APP_CONFIG__: JSON.stringify(appConfig),
    },
    build: {
      target: 'es2022',
    },
  }
})
