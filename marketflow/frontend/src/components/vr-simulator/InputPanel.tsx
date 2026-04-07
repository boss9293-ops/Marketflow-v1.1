'use client'

import { useState } from 'react'
import { StrategyInputs, ValidationIssue } from '@/lib/backtest/types'

/* ── Symbol catalog ──────────────────────────────────────────────────── */
const LEVERAGE_SYMBOLS = [
  { symbol: 'TQQQ', label: 'ProShares UltraPro QQQ', factor: '3x' },
  { symbol: 'QLD',  label: 'ProShares Ultra QQQ',    factor: '2x' },
  { symbol: 'SOXL', label: 'Direxion Semi Bull 3X',  factor: '3x' },
  { symbol: 'TECL', label: 'Direxion Tech Bull 3X',  factor: '3x' },
  { symbol: 'UPRO', label: 'ProShares UltraPro S&P500', factor: '3x' },
  { symbol: 'SPXL', label: 'Direxion S&P500 Bull 3X', factor: '3x' },
  { symbol: 'UDOW', label: 'ProShares UltraPro Dow30', factor: '3x' },
  { symbol: 'TNA',  label: 'Direxion Russell2000 Bull 3X', factor: '3x' },
  { symbol: 'LABU', label: 'Direxion Biotech Bull 3X', factor: '3x' },
  { symbol: 'FNGU', label: 'MicroSectors FANG+ 3X',   factor: '3x' },
  { symbol: 'FAS',  label: 'Direxion Financial Bull 3X', factor: '3x' },
  { symbol: 'CURE', label: 'Direxion Healthcare Bull 3X', factor: '3x' },
  { symbol: 'DRN',  label: 'Direxion Real Estate Bull 3X', factor: '3x' },
  { symbol: 'MIDU', label: 'Direxion Mid Cap Bull 3X', factor: '3x' },
  { symbol: 'URTY', label: 'ProShares UltraPro Russell2000', factor: '3x' },
  { symbol: 'UMDD', label: 'ProShares UltraPro MidCap400', factor: '2x' },
  { symbol: 'EDC',  label: 'Direxion EM Bull 3X',    factor: '3x' },
  { symbol: 'HIBL', label: 'Direxion High Beta Bull 3X', factor: '3x' },
  { symbol: 'WEBL', label: 'Direxion Internet Bull 3X', factor: '3x' },
  { symbol: 'DUSL', label: 'Direxion Industrials Bull 3X', factor: '3x' },
]

const TOP20_SYMBOLS = [
  { symbol: 'NVDA',  label: 'NVIDIA' },
  { symbol: 'AAPL',  label: 'Apple' },
  { symbol: 'MSFT',  label: 'Microsoft' },
  { symbol: 'AMZN',  label: 'Amazon' },
  { symbol: 'GOOGL', label: 'Alphabet' },
  { symbol: 'META',  label: 'Meta Platforms' },
  { symbol: 'TSLA',  label: 'Tesla' },
  { symbol: 'AVGO',  label: 'Broadcom' },
  { symbol: 'LLY',   label: 'Eli Lilly' },
  { symbol: 'V',     label: 'Visa' },
  { symbol: 'JPM',   label: 'JPMorgan Chase' },
  { symbol: 'WMT',   label: 'Walmart' },
  { symbol: 'XOM',   label: 'ExxonMobil' },
  { symbol: 'UNH',   label: 'UnitedHealth' },
  { symbol: 'MA',    label: 'Mastercard' },
  { symbol: 'ORCL',  label: 'Oracle' },
  { symbol: 'COST',  label: 'Costco' },
  { symbol: 'HD',    label: 'Home Depot' },
  { symbol: 'NFLX',  label: 'Netflix' },
  { symbol: 'BRK.B', label: 'Berkshire Hathaway' },
]

const INDEX_SYMBOLS = [
  { symbol: 'QQQ',   label: 'Invesco QQQ Trust' },
  { symbol: 'SPY',   label: 'SPDR S&P 500 ETF' },
  { symbol: 'IWM',   label: 'iShares Russell 2000' },
  { symbol: 'DIA',   label: 'SPDR Dow Jones Industrial' },
  { symbol: 'VTI',   label: 'Vanguard Total Market' },
]

type TabKey = 'leverage' | 'top20' | 'index'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'leverage', label: '레버리지 ETF' },
  { key: 'top20',    label: '시총 Top 20' },
  { key: 'index',    label: '지수 ETF' },
]

/* ── Styles ──────────────────────────────────────────────────────────── */
const inputStyle: React.CSSProperties = {
  width: '100%', borderRadius: 10,
  border: '1px solid rgba(255,255,255,0.10)',
  background: 'rgba(255,255,255,0.04)',
  color: '#f8fafc', padding: '0.55rem 0.5rem',
  fontSize: '0.83rem', boxSizing: 'border-box',
}
const labelStyle: React.CSSProperties = {
  color: '#8ea1b9', fontSize: '0.72rem', textTransform: 'uppercase',
  letterSpacing: '0.06em', marginBottom: '0.3rem', display: 'block',
}
const helperStyle: React.CSSProperties = {
  color: '#4b6280', fontSize: '0.69rem', marginTop: '0.25rem',
}

function SectionHeader({ id, label, color = '#38bdf8' }: { id: string; label: string; color?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', margin: '0.9rem 0 0.55rem' }}>
      <div style={{ color, fontSize: '0.67rem', fontWeight: 800, letterSpacing: '0.09em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
        {id} · {label}
      </div>
      <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, ${color}55, transparent)` }} />
    </div>
  )
}

function findIssue(field: ValidationIssue['field'], issues: ValidationIssue[]) {
  return issues.find((i) => i.field === field)?.message ?? null
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

/* ── Symbol Picker ───────────────────────────────────────────────────── */
function SymbolPicker({ value, onChange }: { value: string; onChange: (sym: string) => void }) {
  const [tab, setTab] = useState<TabKey>('leverage')

  const symbolList =
    tab === 'leverage' ? LEVERAGE_SYMBOLS
    : tab === 'top20'  ? TOP20_SYMBOLS
    :                    INDEX_SYMBOLS

  return (
    <div>
      <div style={{ display: 'flex', gap: '0.3rem', marginBottom: '0.45rem', flexWrap: 'wrap' }}>
        {TABS.map(t => {
          const active = tab === t.key
          return (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding: '0.18rem 0.5rem', borderRadius: 999, fontSize: '0.69rem',
              border: `1px solid ${active ? 'rgba(196,255,13,0.45)' : 'rgba(255,255,255,0.10)'}`,
              background: active ? 'rgba(196,255,13,0.12)' : 'rgba(255,255,255,0.04)',
              color: active ? '#d9f99d' : '#6b7280', cursor: 'pointer',
              fontWeight: active ? 700 : 400, transition: 'all 120ms',
            }}>{t.label}</button>
          )
        })}
      </div>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '0.2rem',
        maxHeight: 220, overflowY: 'auto', overflowX: 'hidden',
        background: 'rgba(10,14,24,0.8)', borderRadius: 10,
        border: '1px solid rgba(255,255,255,0.08)', padding: '0.45rem',
      }}>
        {symbolList.map(s => {
          const active = s.symbol === value
          const factor = 'factor' in s ? (s as any).factor as string : null
          return (
            <button key={s.symbol} onClick={() => onChange(s.symbol)} title={s.label} style={{
              padding: '0.2rem 0.1rem', borderRadius: 6, fontSize: '0.71rem',
              border: `1px solid ${active ? 'rgba(196,255,13,0.5)' : 'rgba(255,255,255,0.10)'}`,
              background: active ? 'rgba(196,255,13,0.15)' : 'rgba(255,255,255,0.04)',
              color: active ? '#d9f99d' : '#cbd5e1', cursor: 'pointer',
              fontWeight: active ? 700 : 400, transition: 'all 100ms',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2,
              width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0,
            }}>
              {s.symbol}
              {factor && (
                <span style={{ color: active ? '#86efac' : '#4b5563', fontSize: '0.60rem' }}>{factor}</span>
              )}
            </button>
          )
        })}
      </div>
      <div style={{ color: '#8ea1b9', fontSize: '0.75rem', marginTop: '0.35rem' }}>
        선택: <span style={{ color: '#d9f99d', fontWeight: 700 }}>{value}</span>
        {' · '}
        {[...LEVERAGE_SYMBOLS, ...TOP20_SYMBOLS, ...INDEX_SYMBOLS].find(s => s.symbol === value)?.label ?? ''}
      </div>
    </div>
  )
}

/* ── InputPanel ──────────────────────────────────────────────────────── */
export default function InputPanel({
  inputs,
  validationIssues,
  symbolOptions: _symbolOptions,
  onChange,
}: {
  inputs: StrategyInputs
  validationIssues: ValidationIssue[]
  symbolOptions: Array<{ symbol: string; label: string }>
  onChange: <K extends keyof StrategyInputs>(field: K, value: StrategyInputs[K]) => void
}) {
  const investAmt = inputs.initialInvestAmount > 0
    ? inputs.initialInvestAmount
    : inputs.initialCapital * ((inputs.initialBuyPercent ?? 80) / 100)
  const poolAmt = Math.max(0, inputs.initialCapital - investAmt)

  return (
    <aside style={{
      position: 'sticky', top: 16, alignSelf: 'start',
      borderRadius: 18, border: '1px solid rgba(255,255,255,0.08)',
      background: 'rgba(15,20,30,0.92)', padding: '0.75rem 1rem',
      maxHeight: 'calc(100vh - 2rem)', overflowY: 'auto', overflowX: 'hidden',
    }}>
      {/* Header */}
      <div style={{ marginBottom: '0.75rem' }}>
        <div style={{ color: '#f8fafc', fontWeight: 800, fontSize: '1.0rem' }}>VR Simulator Inputs</div>
        <div style={{ color: '#8ea1b9', fontSize: '0.78rem', lineHeight: 1.5, marginTop: '0.28rem' }}>
          파라미터를 조정하면 백테스트가 즉시 재실행됩니다.
        </div>
      </div>

      <div style={{ display: 'grid', gap: '0.7rem', width: '90%', margin: '0 auto' }}>

        {/* Symbol */}
        <div>
          <span style={labelStyle}>Symbol</span>
          <SymbolPicker value={inputs.symbol} onChange={(sym) => onChange('symbol', sym)} />
        </div>

        {/* ── Section A: Capital Setup ─────────────────────── */}
        <SectionHeader id="A" label="Capital Setup" color="#38bdf8" />

        {/* Start Date + End Date — same row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          <label>
            <span style={labelStyle}>Start Date</span>
            <input type="date" value={inputs.startDate}
              onChange={e => onChange('startDate', e.target.value)}
              style={{ ...inputStyle, borderColor: findIssue('startDate', validationIssues) ? 'rgba(239,68,68,0.55)' : 'rgba(255,255,255,0.10)' }}
            />
            {findIssue('startDate', validationIssues) && (
              <div style={{ color: '#fca5a5', fontSize: '0.69rem', marginTop: '0.2rem' }}>{findIssue('startDate', validationIssues)}</div>
            )}
          </label>
          <div>
            <span style={labelStyle}>End Date</span>
          <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
            <input type="date" value={inputs.endDate ?? ''}
              onChange={e => onChange('endDate', e.target.value)}
              style={{ ...inputStyle, minWidth: 0, flex: 1, borderColor: 'rgba(255,255,255,0.10)', fontSize: '0.76rem', padding: '0.55rem 0.3rem' }}
            />
            <button
              onClick={() => onChange('endDate', todayStr())}
              style={{
                borderRadius: 7, border: '1px solid rgba(196,255,13,0.35)',
                background: 'rgba(196,255,13,0.08)', color: '#d9f99d',
                padding: '0.52rem 0.4rem', fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer',
                whiteSpace: 'nowrap', flexShrink: 0,
              }}
            >
              오늘
            </button>
            {inputs.endDate && (
              <button
                onClick={() => onChange('endDate', '')}
                style={{
                  borderRadius: 7, border: '1px solid rgba(255,255,255,0.10)',
                  background: 'rgba(255,255,255,0.04)', color: '#6b7280',
                  padding: '0.52rem 0.4rem', fontSize: '0.70rem', cursor: 'pointer', flexShrink: 0,
                }}
              >
                ✕
              </button>
            )}
          </div>
            <div style={helperStyle}>빈 칸 = 전체 데이터 사용</div>
          </div>
        </div>

        {/* Total Capital */}
        <label>
          <span style={labelStyle}>Total Capital ($)</span>
          <input type="number" value={inputs.initialCapital} min={1} step="100"
            onChange={e => {
              const cap = Number(e.target.value)
              const newInvest = Math.min(investAmt, cap - 1)
              onChange('initialCapital', cap)
              onChange('initialInvestAmount', newInvest)
            }}
            style={{ ...inputStyle, borderColor: findIssue('initialCapital', validationIssues) ? 'rgba(239,68,68,0.55)' : 'rgba(255,255,255,0.10)' }}
          />
        </label>

        {/* Initial Invest + Initial Pool — same row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          <label>
            <span style={labelStyle}>Initial Invest ($)</span>
            <input type="number" value={investAmt} min={1} max={inputs.initialCapital - 1} step="100"
              onChange={e => {
                const v = Number(e.target.value)
                onChange('initialInvestAmount', v)
                if (inputs.initialCapital > 0)
                  onChange('initialBuyPercent', Math.round(v / inputs.initialCapital * 100))
              }}
              style={{ ...inputStyle, borderColor: findIssue('initialInvestAmount', validationIssues) ? 'rgba(239,68,68,0.55)' : 'rgba(255,255,255,0.10)' }}
            />
            {findIssue('initialInvestAmount', validationIssues) && (
              <div style={{ color: '#fca5a5', fontSize: '0.69rem', marginTop: '0.2rem' }}>{findIssue('initialInvestAmount', validationIssues)}</div>
            )}
          </label>
          <label>
            <span style={labelStyle}>Initial Pool ($)</span>
            <input type="number" value={poolAmt} min={1} max={inputs.initialCapital - 1} step="100"
              onChange={e => {
                const v = Number(e.target.value)
                const newInvest = Math.max(1, inputs.initialCapital - v)
                onChange('initialInvestAmount', newInvest)
                if (inputs.initialCapital > 0)
                  onChange('initialBuyPercent', Math.round(newInvest / inputs.initialCapital * 100))
              }}
              style={{ ...inputStyle, borderColor: 'rgba(56,189,248,0.22)' }}
            />
            <div style={helperStyle}>Invest + Pool = ${inputs.initialCapital.toLocaleString()}</div>
          </label>
        </div>

        {/* ── Section B: Cycle Engine ──────────────────────── */}
        <SectionHeader id="B" label="Cycle Engine" color="#a78bfa" />

        {/* Cycle Length */}
        <div>
          <span style={labelStyle}>Cycle Length (days)</span>
          <div style={{ display: 'flex', gap: '0.3rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
            {([5, 10, 15, 20] as const).map(d => (
              <button
                key={d}
                type="button"
                onClick={() => onChange('rebalanceDays', d)}
                style={{
                  padding: '0.18rem 0.55rem', borderRadius: 7, fontSize: '0.76rem',
                  border: `1px solid ${inputs.rebalanceDays === d ? 'rgba(167,139,250,0.55)' : 'rgba(255,255,255,0.10)'}`,
                  background: inputs.rebalanceDays === d ? 'rgba(167,139,250,0.15)' : 'rgba(255,255,255,0.04)',
                  color: inputs.rebalanceDays === d ? '#c4b5fd' : '#6b7280',
                  cursor: 'pointer', fontWeight: inputs.rebalanceDays === d ? 700 : 400,
                  transition: 'all 100ms',
                }}
              >
                {d}일
              </button>
            ))}
          </div>
          <input type="number" value={inputs.rebalanceDays} min={1} step="1"
            onChange={e => onChange('rebalanceDays', Number(e.target.value))}
            style={{ ...inputStyle, borderColor: findIssue('rebalanceDays', validationIssues) ? 'rgba(239,68,68,0.55)' : 'rgba(255,255,255,0.10)' }}
          />
          {findIssue('rebalanceDays', validationIssues) && (
            <div style={{ color: '#fca5a5', fontSize: '0.72rem', marginTop: '0.28rem' }}>{findIssue('rebalanceDays', validationIssues)}</div>
          )}
        </div>

        {/* Cycle Allocation Rate */}
        <label>
          <span style={labelStyle}>Cycle Allocation (%)</span>
          <input type="number" value={inputs.cycleAllocationRate ?? 50} min={1} max={100} step="5"
            onChange={e => onChange('cycleAllocationRate', Number(e.target.value))}
            style={{ ...inputStyle, borderColor: findIssue('cycleAllocationRate', validationIssues) ? 'rgba(239,68,68,0.55)' : 'rgba(255,255,255,0.10)' }}
          />
          <div style={helperStyle}>
            사이클당 Pool 사용 한도. 예: 50% → cycleCap = poolCash × 50%
          </div>
          {findIssue('cycleAllocationRate', validationIssues) && (
            <div style={{ color: '#fca5a5', fontSize: '0.72rem', marginTop: '0.28rem' }}>{findIssue('cycleAllocationRate', validationIssues)}</div>
          )}
        </label>


        {/* Cycle Add + G Value — same row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          <label>
            <span style={labelStyle}>Cycle Add ($)</span>
            <input type="number" value={inputs.fixedAdd ?? 0} min={0} step="100"
              onChange={e => onChange('fixedAdd', Number(e.target.value))}
              style={{ ...inputStyle }}
            />
            <div style={helperStyle}>사이클 Pool 추가입금</div>
          </label>
          <label>
            <span style={labelStyle}>G Value</span>
            <input type="number" value={inputs.initialGValue ?? 1} min={0.1} step="0.1"
              onChange={e => onChange('initialGValue', Number(e.target.value))}
              style={{ ...inputStyle }}
            />
            <div style={helperStyle}>P/V 보수성 배수</div>
          </label>
        </div>

        {/* ── Section C: Valuation Band ────────────────────── */}
        <SectionHeader id="C" label="Valuation Band" color="#34d399" />

        {/* Vmin / Vmax — same row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          <label>
            <span style={{ ...labelStyle, color: '#38bdf8' }}>Vmin Ratio</span>
            <input type="number" value={inputs.lowerMult} min={0.01} max={0.99} step="0.01"
              onChange={e => onChange('lowerMult', Number(e.target.value))}
              style={{ ...inputStyle, borderColor: findIssue('lowerMult', validationIssues) ? 'rgba(239,68,68,0.55)' : 'rgba(56,189,248,0.25)' }}
            />
            {findIssue('lowerMult', validationIssues)
              ? <div style={{ color: '#fca5a5', fontSize: '0.69rem', marginTop: '0.2rem' }}>{findIssue('lowerMult', validationIssues)}</div>
              : <div style={helperStyle}>매수 트리거</div>}
          </label>
          <label>
            <span style={{ ...labelStyle, color: '#fb923c' }}>Vmax Ratio</span>
            <input type="number" value={inputs.upperMult} min={1.01} step="0.01"
              onChange={e => onChange('upperMult', Number(e.target.value))}
              style={{ ...inputStyle, borderColor: findIssue('upperMult', validationIssues) ? 'rgba(239,68,68,0.55)' : 'rgba(251,146,60,0.25)' }}
            />
            {findIssue('upperMult', validationIssues)
              ? <div style={{ color: '#fca5a5', fontSize: '0.69rem', marginTop: '0.2rem' }}>{findIssue('upperMult', validationIssues)}</div>
              : <div style={helperStyle}>매도 트리거</div>}
          </label>
        </div>

        {/* ── Section D: Risk Control ──────────────────────── */}
        <SectionHeader id="D" label="Risk Control" color="#fb923c" />

        {/* Disable Buy Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={labelStyle}>매수 금지</div>
            <div style={{ ...helperStyle, marginTop: 0 }}>ON 시 INIT_BUY 이후 매수 없음</div>
          </div>
          <button
            onClick={() => onChange('disableBuy', !inputs.disableBuy)}
            style={{
              borderRadius: 999, padding: '0.22rem 0.65rem',
              border: `1px solid ${inputs.disableBuy ? 'rgba(239,68,68,0.55)' : 'rgba(255,255,255,0.10)'}`,
              background: inputs.disableBuy ? 'rgba(239,68,68,0.14)' : 'rgba(255,255,255,0.04)',
              color: inputs.disableBuy ? '#fca5a5' : '#6b7280',
              fontSize: '0.74rem', cursor: 'pointer', fontWeight: 700,
            }}
          >
            {inputs.disableBuy ? 'ON' : 'OFF'}
          </button>
        </div>

        {/* Disable Sell Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={labelStyle}>매도 금지</div>
            <div style={{ ...helperStyle, marginTop: 0 }}>ON 시 매도 신호 무시 (홀드)</div>
          </div>
          <button
            onClick={() => onChange('disableSell', !inputs.disableSell)}
            style={{
              borderRadius: 999, padding: '0.22rem 0.65rem',
              border: `1px solid ${inputs.disableSell ? 'rgba(239,68,68,0.55)' : 'rgba(255,255,255,0.10)'}`,
              background: inputs.disableSell ? 'rgba(239,68,68,0.14)' : 'rgba(255,255,255,0.04)',
              color: inputs.disableSell ? '#fca5a5' : '#6b7280',
              fontSize: '0.74rem', cursor: 'pointer', fontWeight: 700,
            }}
          >
            {inputs.disableSell ? 'ON' : 'OFF'}
          </button>
        </div>

        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          borderRadius: 6, border: '1px solid rgba(251,146,60,0.28)',
          background: 'rgba(251,146,60,0.07)', padding: '0.22rem 0.55rem',
          color: '#fdba74', fontSize: '0.68rem', fontWeight: 700,
        }}>
          Experimental — coming next
        </div>

        {/* Guard Mode */}
        <div>
          <span style={labelStyle}>Guard Mode</span>
          <select
            value={inputs.guardMode ?? 'off'}
            onChange={e => onChange('guardMode', e.target.value as StrategyInputs['guardMode'])}
            style={{ ...inputStyle, maxWidth: '100%', boxSizing: 'border-box' }}
          >
            <option value="off">Off — 가드 없음</option>
            <option value="weak">Weak — 약한 방어</option>
            <option value="moderate">Moderate — 중간 방어</option>
            <option value="strong">Strong — 강한 방어</option>
          </select>
        </div>

        {/* DD Speed Filter */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={labelStyle}>DD Speed Filter</div>
            <div style={{ ...helperStyle, marginTop: 0 }}>급락 속도 감지 필터</div>
          </div>
          <button
            onClick={() => onChange('enableDdSpeedFilter', !inputs.enableDdSpeedFilter)}
            style={{
              borderRadius: 999, padding: '0.22rem 0.65rem',
              border: `1px solid ${inputs.enableDdSpeedFilter ? 'rgba(56,189,248,0.45)' : 'rgba(255,255,255,0.10)'}`,
              background: inputs.enableDdSpeedFilter ? 'rgba(56,189,248,0.12)' : 'rgba(255,255,255,0.04)',
              color: inputs.enableDdSpeedFilter ? '#7dd3fc' : '#6b7280',
              fontSize: '0.74rem', cursor: 'pointer', fontWeight: 700,
            }}
          >
            {inputs.enableDdSpeedFilter ? 'ON' : 'OFF'}
          </button>
        </div>

        {/* MA Filter */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={labelStyle}>MA Filter</div>
            <div style={{ ...helperStyle, marginTop: 0 }}>이동평균 추세 필터</div>
          </div>
          <button
            onClick={() => onChange('enableMaFilter', !inputs.enableMaFilter)}
            style={{
              borderRadius: 999, padding: '0.22rem 0.65rem',
              border: `1px solid ${inputs.enableMaFilter ? 'rgba(56,189,248,0.45)' : 'rgba(255,255,255,0.10)'}`,
              background: inputs.enableMaFilter ? 'rgba(56,189,248,0.12)' : 'rgba(255,255,255,0.04)',
              color: inputs.enableMaFilter ? '#7dd3fc' : '#6b7280',
              fontSize: '0.74rem', cursor: 'pointer', fontWeight: 700,
            }}
          >
            {inputs.enableMaFilter ? 'ON' : 'OFF'}
          </button>
        </div>

      </div>

      {/* Footer */}
      {validationIssues.some(i => i.field === 'bars') ? (
        <div style={{
          marginTop: '0.9rem', borderRadius: 12,
          border: '1px solid rgba(239,68,68,0.18)', background: 'rgba(239,68,68,0.08)',
          color: '#fecaca', padding: '0.75rem', fontSize: '0.8rem', lineHeight: 1.5,
        }}>
          {findIssue('bars', validationIssues)}
        </div>
      ) : (
        <div style={{
          marginTop: '0.9rem', borderRadius: 12,
          border: '1px solid rgba(167,139,250,0.14)', background: 'rgba(167,139,250,0.05)',
          color: '#c4b5fd', padding: '0.75rem', fontSize: '0.78rem', lineHeight: 1.55,
        }}>
          <strong>매수</strong>: eval &lt; Vmin → BuyReq = Vmin − eval (gap)<br />
          &nbsp;&nbsp;ActualBuy = min(BuyReq, Pool, PerTrade, CycleCap)<br />
          <strong>매도</strong>: eval &gt; Vmax → SellReq = eval − Vmax (gap)<br />
          &nbsp;&nbsp;ActualSell = min(SellReq, shares×close)<br />
          <strong>G</strong>: 사이클 리셋 시 Vref 보수성. G=1 → Vref=eval
        </div>
      )}
    </aside>
  )
}
