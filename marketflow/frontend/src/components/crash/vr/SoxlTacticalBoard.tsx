'use client'

import React from 'react'
import SoxlLeadershipPanel, { type SoxxContextPayload } from './SoxlLeadershipPanel'

export default function SoxlTacticalBoard({ context }: { context: SoxxContextPayload | null }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', fontFamily: 'monospace' }}>
      
      {/* [Top] Current Regime & Action */}
      <section style={{
        background: 'rgba(15,23,42,0.6)',
        border: '1px solid rgba(56,189,248,0.2)',
        borderRadius: 12,
        padding: '1.2rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.8rem'
      }}>
        <div style={{ fontSize: '0.75rem', color: '#7dd3fc', letterSpacing: '0.15em', fontWeight: 800 }}>
          CURRENT REGIME & ACTION
        </div>
        <div style={{ fontSize: '1.1rem', color: '#f8fafc', fontWeight: 700 }}>
          "AI CapEx 확장기이나 단기 공급 병목에 의한 조정 국면"
        </div>
        <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
          <div style={{ padding: '0.5rem 1rem', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 6, color: '#4ade80' }}>
            <span style={{ fontSize: '0.8rem', display: 'block', marginBottom: 2 }}>SOXX (Anchor)</span>
            <strong style={{ fontSize: '1.1rem' }}>HOLD</strong>
          </div>
          <div style={{ padding: '0.5rem 1rem', background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.3)', borderRadius: 6, color: '#facc15' }}>
            <span style={{ fontSize: '0.8rem', display: 'block', marginBottom: 2 }}>SOXL (Tactical)</span>
            <strong style={{ fontSize: '1.1rem' }}>WAIT</strong>
          </div>
        </div>
      </section>

      {/* [Section 1] Cycle Drivers */}
      <section style={{
        background: 'rgba(15,23,42,0.4)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 12,
        padding: '1.2rem'
      }}>
        <div style={{ fontSize: '0.75rem', color: '#cbd5e1', letterSpacing: '0.15em', fontWeight: 800, marginBottom: '1rem' }}>
          CYCLE DRIVERS <span style={{ color: '#64748b', fontWeight: 400 }}>(사실 및 전망)</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <DriverCard title="WSTS 글로벌 반도체 매출" value="TBD" updateCycle="Monthly" />
          <DriverCard title="SEMI 장비 Billings" value="TBD" updateCycle="Monthly" />
          <DriverCard title="FRED 반도체 생산지수" value="TBD" updateCycle="Monthly" />
          <DriverCard title="재고/출하 비율 (I/S)" value="TBD" updateCycle="Monthly" />
          <DriverCard title="Hyperscaler CapEx" value="TBD" updateCycle="Quarterly" />
        </div>
      </section>

      {/* [Section 2] Leadership Map */}
      <section style={{
        background: 'rgba(15,23,42,0.4)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 12,
        padding: '1.2rem'
      }}>
        <div style={{ fontSize: '0.75rem', color: '#cbd5e1', letterSpacing: '0.15em', fontWeight: 800, marginBottom: '1rem' }}>
          LEADERSHIP MAP <span style={{ color: '#64748b', fontWeight: 400 }}>(내부 신호)</span>
        </div>
        <div style={{ border: '1px solid rgba(255,255,255,0.05)', borderRadius: 8, overflow: 'hidden' }}>
          <SoxlLeadershipPanel context={context} />
        </div>
      </section>

      {/* [Section 3] Risk & Catalyst */}
      <section style={{
        background: 'rgba(15,23,42,0.4)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 12,
        padding: '1.2rem'
      }}>
        <div style={{ fontSize: '0.75rem', color: '#cbd5e1', letterSpacing: '0.15em', fontWeight: 800, marginBottom: '1rem' }}>
          RISK & CATALYST <span style={{ color: '#64748b', fontWeight: 400 }}>(외력 및 촉매)</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
          <RiskCard title="거시 경제" items={['금리 (Rates)', '달러 (USD)']} />
          <RiskCard title="지정학 & 정책" items={['수출 통제 (Export Control)', '관세 이슈']} />
          <RiskCard title="마이크로" items={['실적 시즌 일정', 'HBM/CoWoS 리드타임']} />
        </div>
      </section>
      
    </div>
  )
}

function DriverCard({ title, value, updateCycle }: { title: string, value: string, updateCycle: string }) {
  return (
    <div style={{ padding: '0.8rem', background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)' }}>
      <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: '0.3rem' }}>{title}</div>
      <div style={{ fontSize: '1rem', color: '#f8fafc', fontWeight: 700 }}>{value}</div>
      <div style={{ fontSize: '0.65rem', color: '#64748b', marginTop: '0.3rem', textAlign: 'right' }}>{updateCycle}</div>
    </div>
  )
}

function RiskCard({ title, items }: { title: string, items: string[] }) {
  return (
    <div style={{ padding: '0.8rem', background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)' }}>
      <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.5rem', fontWeight: 700 }}>{title}</div>
      <ul style={{ margin: 0, paddingLeft: '1.2rem', color: '#cbd5e1', fontSize: '0.85rem' }}>
        {items.map(item => (
          <li key={item} style={{ marginBottom: '0.2rem' }}>{item}</li>
        ))}
      </ul>
    </div>
  )
}
