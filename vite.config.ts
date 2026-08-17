import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig, type Plugin } from 'vite'

interface BuildMetaConfig {
  meta: {
    title: string
    description: string
    canonicalUrl: string
    shareImage: string
  }
}

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

/** 从公开配置生成开发与生产环境共用的社媒元信息，喵~ */
function configDrivenMetadata(): Plugin {
  const configPath = fileURLToPath(new URL('./public/config.json', import.meta.url))

  return {
    name: 'reward-page-config-driven-metadata',
    transformIndexHtml(html) {
      const config = JSON.parse(readFileSync(configPath, 'utf8')) as BuildMetaConfig
      const replacements: Record<string, string> = {
        __META_TITLE__: config.meta.title,
        __META_DESCRIPTION__: config.meta.description,
        __META_CANONICAL_URL__: config.meta.canonicalUrl,
        __META_SHARE_IMAGE__: resolveShareImage(config.meta.canonicalUrl, config.meta.shareImage),
      }

      return Object.entries(replacements).reduce(
        (output, [token, value]) => output.replaceAll(token, escapeHtml(value)),
        html,
      )
    },
  }
}

/** 创建个人赞赏页的 Vite 配置，喵~ */
export default defineConfig({
  plugins: [configDrivenMetadata()],
  build: {
    target: 'es2022',
  },
})
