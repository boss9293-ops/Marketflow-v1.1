import type { CSSProperties } from 'react'

import { PortfolioSheetWorkspace } from './PortfolioSheetWorkspace'

export const dynamic = 'force-dynamic'

const pageStyle: CSSProperties = {
  minHeight: '100%',
  padding: '1.5rem 1.75rem 2rem',
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
}

const panelStyle: CSSProperties = {
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'linear-gradient(145deg, rgba(30,33,41,0.92), rgba(20,22,29,0.92))',
  borderRadius: 8,
  padding: '0.92rem',
}

const mutedText: CSSProperties = {
  color: '#8b93a8',
  fontSize: '0.78rem',
  lineHeight: 1.5,
}

export default function PortfolioSheetPage() {
  return (
    <div style={pageStyle}>
      <header style={{ ...panelStyle, display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ maxWidth: 920 }}>
          <div style={{ color: '#67e8f9', fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            Account Ledger
          </div>
          <h1 style={{ margin: '0.25rem 0 0', color: '#f3f4f6', fontSize: '1.9rem', lineHeight: 1.1, fontWeight: 900 }}>
            Portfolio Sheet
          </h1>
          <p style={{ ...mutedText, marginTop: 8, maxWidth: 820 }}>
            App-native portfolio ledger based on the current Google Sheets format. User inputs only ticker, shares, and average price. All other values are calculated internally.
          </p>
        </div>
        <div
          style={{
            alignSelf: 'flex-start',
            border: '1px solid rgba(34,197,94,0.28)',
            background: 'rgba(34,197,94,0.10)',
            color: '#86efac',
            borderRadius: 999,
            padding: '0.28rem 0.58rem',
            fontSize: '0.72rem',
            fontWeight: 800,
            whiteSpace: 'nowrap',
          }}
        >
          Internal SQLite
        </div>
      </header>

      <PortfolioSheetWorkspace />
    </div>
  )
}
