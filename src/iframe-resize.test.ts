import { afterEach, describe, expect, it, vi } from 'vitest'
import { createResizeMessage, setupIframeAutoResize } from './iframe-resize'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('createResizeMessage', () => {
  it('向上取整并限制高度不能为负数', () => {
    expect(createResizeMessage(620.2)).toEqual({
      type: 'appreciation-page:resize',
      version: 1,
      height: 621,
    })
    expect(createResizeMessage(-1).height).toBe(0)
  })
})

describe('setupIframeAutoResize', () => {
  it('顶层页面不会注册监听或发送消息', () => {
    const fakeWindow: { parent?: unknown } = {}
    fakeWindow.parent = fakeWindow
    vi.stubGlobal('window', fakeWindow)
    expect(setupIframeAutoResize()).toBeTypeOf('function')
  })
})
