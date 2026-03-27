import CustomRRGChart from '@/components/CustomRRGChart'
import RRGChart from '@/components/RRGChart'

export default function SectorRRGPage() {
  return (
    <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>

      {/* Page header */}
      <div>
        <h1 style={{ fontSize: '2rem', fontWeight: 700, color: 'white' }}>
          Sector <span style={{ color: '#14b8a6' }}>RRG</span>
        </h1>
        <p style={{ color: '#6b7280', marginTop: '0.5rem' }}>
          Relative Rotation Graph — 섹터 &amp; 커스텀 심볼 로테이션 분석
        </p>
      </div>

      {/* Custom symbol RRG */}
      <div style={{
        background: '#13181f',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 14,
        padding: '1.5rem',
      }}>
        <CustomRRGChart />
      </div>

      {/* Sector RRG */}
      <div style={{
        background: '#13181f',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 14,
        padding: '1.5rem',
      }}>
        <div style={{ marginBottom: '1rem' }}>
          <h2 style={{ color: '#F8FCFF', fontWeight: 700, fontSize: '1.15rem', margin: 0 }}>
            Sector ETF RRG
          </h2>
          <p style={{ color: '#6b7280', fontSize: '0.8rem', marginTop: 4 }}>
            11개 SPDR 섹터 ETF — SPY 기준 상대강도 로테이션
          </p>
        </div>
        <RRGChart />
      </div>

    </div>
  )
}
