'use client'

import { useEffect, useState } from 'react'

type ValidationStatus = {
  status: 'OK' | 'Watch'
  snapshot_date: string
  revision_detected: boolean
}

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_API || 'http://localhost:5001'

export default function ValidationBadge() {
  const [data, setData] = useState<ValidationStatus | null>(null)

  useEffect(() => {
    let alive = true
    fetch(`${API_BASE}/api/macro/validation/status`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((json) => {
        if (!alive) return
        setData({
          status: json?.status === 'OK' ? 'OK' : 'Watch',
          snapshot_date: typeof json?.snapshot_date === 'string' ? json.snapshot_date : '',
          revision_detected: Boolean(json?.revision_detected),
        })
      })
      .catch(() => {
        if (alive) setData(null)
      })
    return () => {
      alive = false
    }
  }, [])

  if (!data) return null

  const cls =
    data.status === 'OK'
      ? 'border-emerald-400/30 text-emerald-300 bg-emerald-400/10'
      : 'border-amber-400/30 text-amber-300 bg-amber-400/10'

  const tooltip =
    data.status === 'OK'
      ? 'Playback checks passed. No data revision detected.'
      : 'Regression check failed or data revision detected.'

  return (
    <div className="flex items-center gap-2">
      <span
        title={tooltip}
        className={`px-2 py-0.5 rounded-full text-xs border ${cls}`}
      >
        [Validation: {data.status}]
      </span>
      <span className="text-xs text-slate-300">
        {data.snapshot_date || '—'}
      </span>
    </div>
  )
}

