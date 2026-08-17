export interface ResizeMessage {
  type: 'appreciation-page:resize'
  version: 1
  height: number
}

/** 创建公开且不包含页面内容的 iframe 高度消息，喵~ */
export function createResizeMessage(height: number): ResizeMessage {
  return {
    type: 'appreciation-page:resize',
    version: 1,
    height: Math.max(0, Math.ceil(height)),
  }
}

/** 在嵌入场景中监听文档尺寸，并逐帧合并高度消息，喵~ */
export function setupIframeAutoResize(): () => void {
  if (window.parent === window) return () => undefined

  let frameId: number | undefined
  const sendHeight = (): void => {
    if (frameId !== undefined) return
    frameId = window.requestAnimationFrame(() => {
      frameId = undefined
      const height = Math.max(
        document.documentElement.scrollHeight,
        document.body.scrollHeight,
        document.documentElement.getBoundingClientRect().height,
      )
      window.parent.postMessage(createResizeMessage(height), '*')
    })
  }

  const observer = new ResizeObserver(sendHeight)
  observer.observe(document.documentElement)
  window.addEventListener('reward-page:image-settled', sendHeight)
  sendHeight()

  return () => {
    observer.disconnect()
    window.removeEventListener('reward-page:image-settled', sendHeight)
    if (frameId !== undefined) window.cancelAnimationFrame(frameId)
  }
}
