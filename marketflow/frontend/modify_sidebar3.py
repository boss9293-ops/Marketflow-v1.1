import sys

file_path = r'd:\Youtube_pro\000-Code_develop\주식분석\us_market_complete\marketflow\frontend\src\components\Sidebar.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read().replace('\r\n', '\n')

old_vr = """const vrTestItems = [
  { href: '/vr-simulator', label: { ko: 'VR-Test', en: 'VR-Test' }, dot: '#c4ff0d', subLabel: { ko: 'VR G-Value 백테스트', en: 'VR G-Value Backtest' } },
]"""

new_vr = """const vrTestItems = [
  { href: '/vr-simulator', label: { ko: 'VR-Test', en: 'VR-Test' }, dot: '#c4ff0d', subLabel: { ko: 'VR G-Value 백테스트', en: 'VR G-Value Backtest' } },
  { href: '/strategy-sim',    label: { ko: '전략 시뮬레이션',       en: 'Strategy Sim' }, dot: '#f59e0b', subLabel: { ko: '매수 전략 백테스터', en: 'DCA Backtester' } },
]"""
content = content.replace(old_vr, new_vr)

old_lv = """// ── Zone LV: 레버리지 길들이기 ───────────────────────────────────────────────
const lvItems = [
  { href: '/vr-survival',     label: { ko: 'VR Survival',          en: 'VR (TQQQ)' },    dot: '#a78bfa', subLabel: { ko: 'TQQQ 생존 시스템',  en: 'Leverage Survival' } },
  { href: '/strategy-sim',    label: { ko: '전략 시뮬레이션',       en: 'Strategy Sim' }, dot: '#f59e0b', subLabel: { ko: '매수 전략 백테스터', en: 'DCA Backtester' } },
  { href: '/backtest',        label: { ko: 'Backtests',            en: 'Backtests' },     dot: '#22c55e', subLabel: { ko: '전략 검증 레퍼런스', en: 'Reference' } },
]"""

new_lv = """// ── Zone LV: 레버리지 길들이기 ───────────────────────────────────────────────
const lvItems = [
  { href: '/vr-survival',     label: { ko: 'VR Survival',          en: 'VR (TQQQ)' },    dot: '#a78bfa', subLabel: { ko: 'TQQQ 생존 시스템',  en: 'Leverage Survival' } },
  { href: '/backtest',        label: { ko: 'Backtests',            en: 'Backtests' },     dot: '#22c55e', subLabel: { ko: '전략 검증 레퍼런스', en: 'Reference' } },
]"""
content = content.replace(old_lv, new_lv)

old_label = """        <ZoneHeader
          icon={<span style={{ fontSize: '0.82rem', color: '#d9f99d' }}>VR</span>}
          label={compact ? 'VR' : 'VR-Test'}
          badge="NEW"
          badgeColor="#c4ff0d"
          onClick={() => setVrTestOpen((p) => !p)}
          isOpen={vrTestOpen}
          compact={compact}
        />"""

new_label = """        <ZoneHeader
          icon={<span style={{ fontSize: '0.82rem', color: '#d9f99d' }}>VR</span>}
          label={compact ? 'VR' : '전략시뮬레이터'}
          badge="NEW"
          badgeColor="#c4ff0d"
          onClick={() => setVrTestOpen((p) => !p)}
          isOpen={vrTestOpen}
          compact={compact}
        />"""
content = content.replace(old_label, new_label)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Done replacing VR Simulator items")
