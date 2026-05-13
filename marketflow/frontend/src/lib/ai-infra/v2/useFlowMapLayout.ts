'use client'
// AI 인프라 V2 — 뷰포트 너비 기반 FlowMap 레이아웃 방향 훅 (SSR 안전)

import { useEffect, useState } from 'react'

export type FlowOrientation = 'horizontal' | 'vertical'

export function useFlowMapLayout(): FlowOrientation {
  const [orientation, setOrientation] = useState<FlowOrientation>('horizontal')

  useEffect(() => {
    const update = () =>
      setOrientation(window.innerWidth < 768 ? 'vertical' : 'horizontal')
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  return orientation
}
