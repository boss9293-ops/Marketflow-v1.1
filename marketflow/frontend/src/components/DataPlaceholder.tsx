import type { CSSProperties } from 'react'

type DataPlaceholderProps = {
  reason?: string
  cacheFile?: string
  script?: string
  text?: string
  style?: CSSProperties
}

export default function DataPlaceholder({
  reason,
  cacheFile,
  script,
  text = '--',
  style,
}: DataPlaceholderProps) {
  const parts = []
  if (reason) parts.push(reason)
  if (cacheFile) parts.push(`Missing ${cacheFile}`)
  if (script) parts.push(`Run ${script}`)
  const title = parts.length ? parts.join(' | ') : 'Data missing'

  return (
    <span title={title} style={{ color: '#6b7280', fontStyle: 'italic', ...style }}>
      {text}
    </span>
  )
}
