import type { CommentsConfig } from './types'

export const UTTERANCES_SCRIPT_SRC = 'https://utteranc.es/client.js'

export interface UtterancesMessages {
  loading: string
  loadError: string
}

/** 创建固定映射与浅色主题的 utterances 评论组件，喵~ */
export function renderUtterances(
  container: HTMLElement,
  config: CommentsConfig,
  messages: UtterancesMessages,
): HTMLScriptElement {
  const status = document.createElement('p')
  status.className = 'comments__status'
  status.setAttribute('role', 'status')
  status.textContent = messages.loading

  const script = document.createElement('script')
  script.async = true
  script.src = UTTERANCES_SCRIPT_SRC
  script.crossOrigin = 'anonymous'
  script.setAttribute('repo', config.repository)
  script.setAttribute('issue-term', 'pathname')
  script.setAttribute('label', config.label)
  script.setAttribute('theme', 'github-light')
  script.addEventListener('load', () => status.remove(), { once: true })
  script.addEventListener('error', () => {
    script.remove()
    status.classList.add('comments__status--error')
    status.setAttribute('role', 'alert')
    status.textContent = messages.loadError
  }, { once: true })

  container.replaceChildren(status, script)
  return script
}
