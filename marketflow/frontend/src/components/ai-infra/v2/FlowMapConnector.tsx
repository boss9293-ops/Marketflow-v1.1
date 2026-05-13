// AI 인프라 V2 — FlowMap 스테이지 간 연결선 (SVG cubic bezier + arrowhead)

interface ConnectorProps {
  x1: number; y1: number
  x2: number; y2: number
  color?: string
}

export function FlowMapConnector({ x1, y1, x2, y2, color = 'rgba(63,182,168,0.28)' }: ConnectorProps) {
  const mx = (x1 + x2) / 2
  const d  = `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`
  return (
    <path
      d={d}
      fill="none"
      stroke={color}
      strokeWidth={1.5}
      markerEnd="url(#fm-arrow)"
    />
  )
}

export function FlowMapArrowDefs() {
  return (
    <defs>
      <marker
        id="fm-arrow"
        viewBox="0 0 8 8"
        refX={7}
        refY={4}
        markerWidth={5}
        markerHeight={5}
        orient="auto"
      >
        <path d="M 0 1 L 7 4 L 0 7 z" fill="rgba(63,182,168,0.45)" />
      </marker>
    </defs>
  )
}
