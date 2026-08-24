// @vitest-environment happy-dom // 使用轻量浏览器环境，喵~

import { describe, expect, it } from 'vitest'
import { renderUtterances, UTTERANCES_SCRIPT_SRC } from './comments'

describe('renderUtterances', () => {
  it('创建固定映射、浅色主题和匿名跨域脚本', () => {
    const container = document.createElement('div')
    const script = renderUtterances(container, {
      repository: 'WayneGongCN/reward-page',
      label: 'comments',
    }, {
      loading: '正在加载评论…',
      loadError: '评论加载失败',
    })

    expect(script.src).toBe(UTTERANCES_SCRIPT_SRC)
    expect(script.async).toBe(true)
    expect(script.crossOrigin).toBe('anonymous')
    expect(script.getAttribute('repo')).toBe('WayneGongCN/reward-page')
    expect(script.getAttribute('issue-term')).toBe('pathname')
    expect(script.getAttribute('label')).toBe('comments')
    expect(script.getAttribute('theme')).toBe('github-light')
    expect(container.querySelector('.comments__status')?.textContent).toBe('正在加载评论…')
  })

  it('脚本完成后移除加载状态', () => {
    const container = document.createElement('div')
    const script = renderUtterances(container, {
      repository: 'WayneGongCN/reward-page',
      label: 'comments',
    }, {
      loading: 'Loading',
      loadError: 'Failed',
    })

    script.dispatchEvent(new Event('load'))
    expect(container.querySelector('.comments__status')).toBeNull()
  })

  it('脚本失败时保留不影响页面的本地化错误态', () => {
    const container = document.createElement('div')
    const script = renderUtterances(container, {
      repository: 'WayneGongCN/reward-page',
      label: 'comments',
    }, {
      loading: 'Loading',
      loadError: 'Comments failed to load.',
    })

    script.dispatchEvent(new Event('error'))
    const status = container.querySelector('.comments__status')
    expect(status?.textContent).toBe('Comments failed to load.')
    expect(status?.getAttribute('role')).toBe('alert')
    expect(container.querySelector('script')).toBeNull()
  })
})
