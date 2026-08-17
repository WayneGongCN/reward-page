import type { PageMode, PageOptions } from './types'

/** 按公开参数协议解析显示模式、简介和渠道筛选，喵~ */
export function parsePageOptions(search: string, configuredChannelIds: string[]): PageOptions {
  const params = new URLSearchParams(search)
  const requestedMode = params.get('mode')
  const mode: PageMode = requestedMode === 'embed' ? 'embed' : 'full'
  const defaultIntroVisible = mode === 'full'
  const requestedIntro = params.get('intro')
  const introVisible = requestedIntro === '1'
    ? true
    : requestedIntro === '0'
      ? false
      : defaultIntroVisible

  let visibleChannelIds = [...configuredChannelIds]
  if (params.has('channels')) {
    const requestedIds = new Set(
      (params.get('channels') ?? '')
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean),
    )
    visibleChannelIds = configuredChannelIds.filter((id) => requestedIds.has(id))
  }

  return { mode, introVisible, visibleChannelIds }
}
