'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { refreshMacroStore, useMacroStore } from '@/stores/macroStore'
import { pickLang, useLangMode } from '@/lib/useLangMode'

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_API || 'http://localhost:5001'

type ValidationStatus = {
  status?: 'OK' | 'Watch'
  snapshot_date?: string
}

function toneClass(value: string) {
  const s = value.toLowerCase()
  if (s.includes('tight') || s.includes('restrictive') || s.includes('expanding') || s.includes('stress') || s.includes('watch')) {
    return 'border-amber-400/30 text-amber-300 bg-amber-400/10'
  }
  if (s.includes('easy') || s.includes('easing') || s.includes('compressed') || s.includes('align') || s.includes('ok')) {
    return 'border-emerald-400/30 text-emerald-300 bg-emerald-500/10'
  }
  return 'border-white/10 text-slate-200 bg-white/5'
}

function koState(value: string): string {
  const map: Record<string, string> = {
    Easy: '완화',
    Neutral: '중립',
    Tight: '긴축',
    Easing: '완화',
    Stable: '안정',
    Restrictive: '제약',
    Compressed: '압축',
    Normal: '정상',
    Expanding: '확장',
    Align: '정렬',
    Mixed: '혼합',
    Stress: '스트레스',
    OK: '정상',
    Watch: '주의',
  }
  return map[value] || value
}

export default function MacroBadgeStrip() {
  const macro = useMacroStore()
  const mode = useLangMode()
  const [validation, setValidation] = useState<ValidationStatus | null>(null)

  useEffect(() => {
    if (!macro.data && !macro.loading && !macro.error) refreshMacroStore()
  }, [macro.data, macro.loading, macro.error])

  useEffect(() => {
    let alive = true
    fetch(`${API_BASE}/api/macro/validation/status`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((json) => { if (alive) setValidation(json || null) })
      .catch(() => { if (alive) setValidation(null) })
    return () => { alive = false }
  }, [])

  const chips = useMemo(() => {
    const c = macro.data?.computed || {}
    const liq = c.LPI?.status as string | undefined
    const rates = c.RPI?.status as string | undefined
    const vol = c.VRI?.status as string | undefined
    const xconf = c.XCONF?.status as string | undefined
    const val = validation?.status
    const valDate = validation?.snapshot_date

    const list = [
      liq ? { key: 'liq', label: pickLang(mode, '유동성', 'Liquidity'), value: mode === 'ko' ? koState(liq) : liq } : null,
      rates ? { key: 'rates', label: pickLang(mode, '금리', 'Rates'), value: mode === 'ko' ? koState(rates) : rates } : null,
      vol ? { key: 'vol', label: pickLang(mode, '변동성', 'Vol'), value: mode === 'ko' ? koState(vol) : vol } : null,
      xconf && xconf !== 'NA' ? { key: 'xconf', label: 'XCONF', value: mode === 'ko' ? koState(xconf) : xconf } : null,
      val ? { key: 'validation', label: pickLang(mode, '검증', 'Validation'), value: `${mode === 'ko' ? koState(val) : val}${valDate ? ` ${valDate}` : ''}` } : null,
    ]
    return list.filter(Boolean) as Array<{ key: string; label: string; value: string }>
  }, [macro.data, validation])

  if (chips.length === 0) return null

  return (
    <Link href="/macro" className="flex items-center gap-1.5 flex-wrap no-underline">
      {chips.map((b) => (
        <span
          key={b.key}
          className={`px-2 py-0.5 rounded-full text-[10px] border ${toneClass(b.value)}`}
          title={pickLang(mode, '매크로 센서 상태입니다. 상세는 Macro Layer에서 확인하세요.', 'Macro sensor state. Open Macro Layer for details.')}
        >
          {b.label}:{b.value}
        </span>
      ))}
    </Link>
  )
}
