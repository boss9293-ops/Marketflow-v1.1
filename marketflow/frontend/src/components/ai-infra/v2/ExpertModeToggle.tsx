// AI 인프라 V2 — 전문가 탭 패널 토글 버튼

interface Props {
  open:     boolean
  onToggle: () => void
}

export function ExpertModeToggle({ open, onToggle }: Props) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'center',
      marginTop: 12, paddingTop: 10,
      borderTop: '1px solid rgba(255,255,255,0.08)',
    }}>
      <button
        onClick={onToggle}
        style={{
          padding: '5px 24px', borderRadius: 3, cursor: 'pointer',
          border: `1px solid ${open ? '#3FB6A8' : 'rgba(255,255,255,0.08)'}`,
          background: open ? 'rgba(63,182,168,0.09)' : 'rgba(255,255,255,0.03)',
          color: open ? '#3FB6A8' : '#B8C8DC',
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 12, fontWeight: 700, letterSpacing: '0.10em',
        }}
      >
        {open ? '▾ 전문가 탭 닫기' : '▸ 전문가 탭 열기'}
      </button>
    </div>
  )
}
