import CustomRRGChart from '@/components/CustomRRGChart'

export default function RRGPage() {
  return (
    <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div>
        <h1 style={{
          fontSize: '1.5rem', fontWeight: 700, color: '#ffffff',
          fontFamily: 'var(--font-ui)', margin: 0,
        }}>
          MarketFlow RRG
        </h1>
        <p style={{
          fontSize: '0.85rem', color: '#8b9098',
          fontFamily: 'var(--font-ui)', margin: '0.25rem 0 0',
        }}>
          Relative strength and momentum rotation
        </p>
      </div>
      <CustomRRGChart />
    </div>
  )
}
