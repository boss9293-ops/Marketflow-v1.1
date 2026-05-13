// AI 인프라 V2 — 주간 수익률 기반 모버스 마커 계산 (|1W| ≥ 10% = 🔥)

export type MarkerType = 'fire' | 'none'

export interface MoversMarker {
  marker_type: MarkerType
  has_marker:  boolean
}

export function buildMoversMarker(return_1w: number | null): MoversMarker {
  if (return_1w === null || !Number.isFinite(return_1w)) {
    return { marker_type: 'none', has_marker: false }
  }
  if (Math.abs(return_1w) >= 10) {
    return { marker_type: 'fire', has_marker: true }
  }
  return { marker_type: 'none', has_marker: false }
}
