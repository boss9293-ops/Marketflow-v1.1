import sys

file_path = r'd:\Youtube_pro\000-Code_develop\주식분석\us_market_complete\marketflow\frontend\src\components\Sidebar.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read().replace('\r\n', '\n')

old_crash = """// ── Zone RM: 위험관리엔진 ────────────────────────────────────────────────────
const crashItems = [
  { href: '/crash',   label: { ko: 'Crash Hub',      en: 'Crash Hub' },      dot: '#ef4444', subLabel: { ko: '허브 · 제품 선택',   en: 'Hub · Select System' } },
  { href: '/risk-v1', label: { ko: 'Standard (QQQ)', en: 'Standard (QQQ)' }, dot: '#6366f1', subLabel: { ko: '리스크 환경 가이드', en: 'Risk Environment' } },
]"""

new_crash = """// ── Top Hubs (Moved to top) ──────────────────────────────────────────────────
const topHubItems = [
  { href: '/crash',           label: { ko: 'Crash Hub',              en: 'Crash Hub' },    dot: '#ef4444', subLabel: { ko: '허브 · 제품 선택', en: 'Hub · Select System' }, vrStyle: true },
  { href: '/crash/navigator', label: { ko: '레버리지 길들이기 허브', en: 'Leverage Hub' }, dot: '#f97316', subLabel: { ko: '모듈 허브',        en: 'Module Hub' } },
]

// ── Zone RM: 위험관리엔진 ────────────────────────────────────────────────────
const crashItems = [
  { href: '/risk-v1', label: { ko: 'Standard (QQQ)', en: 'Standard (QQQ)' }, dot: '#6366f1', subLabel: { ko: '리스크 환경 가이드', en: 'Risk Environment' } },
]"""
content = content.replace(old_crash, new_crash)

old_lv = """// ── Zone LV: 레버리지 길들이기 ───────────────────────────────────────────────
const lvItems = [
  { href: '/crash/navigator', label: { ko: '레버리지 길들이기 허브', en: 'Leverage Hub' },  dot: '#f97316', subLabel: { ko: '모듈 허브',          en: 'Module Hub' } },
  { href: '/vr-survival',     label: { ko: 'VR Survival',          en: 'VR (TQQQ)' },    dot: '#a78bfa', subLabel: { ko: 'TQQQ 생존 시스템',  en: 'Leverage Survival' } },
  { href: '/strategy-sim',    label: { ko: '전략 시뮬레이션',       en: 'Strategy Sim' }, dot: '#f59e0b', subLabel: { ko: '매수 전략 백테스터', en: 'DCA Backtester' } },
  { href: '/backtest',        label: { ko: 'Backtests',            en: 'Backtests' },     dot: '#22c55e', subLabel: { ko: '전략 검증 레퍼런스', en: 'Reference' } },
]"""

new_lv = """// ── Zone LV: 레버리지 길들이기 ───────────────────────────────────────────────
const lvItems = [
  { href: '/vr-survival',     label: { ko: 'VR Survival',          en: 'VR (TQQQ)' },    dot: '#a78bfa', subLabel: { ko: 'TQQQ 생존 시스템',  en: 'Leverage Survival' } },
  { href: '/strategy-sim',    label: { ko: '전략 시뮬레이션',       en: 'Strategy Sim' }, dot: '#f59e0b', subLabel: { ko: '매수 전략 백테스터', en: 'DCA Backtester' } },
  { href: '/backtest',        label: { ko: 'Backtests',            en: 'Backtests' },     dot: '#22c55e', subLabel: { ko: '전략 검증 레퍼런스', en: 'Reference' } },
]"""
content = content.replace(old_lv, new_lv)

old_sig = """}: {
  items: Array<{ href: string; label: { ko: string; en: string }; subLabel?: { ko: string; en: string }; dot: string; icon?: 'scan' | 'home'; tooltip?: string }>
  pathname: string"""
new_sig = """}: {
  items: Array<{ href: string; label: { ko: string; en: string }; subLabel?: { ko: string; en: string }; dot: string; icon?: 'scan' | 'home'; tooltip?: string; vrStyle?: boolean }>
  pathname: string"""
content = content.replace(old_sig, new_sig)

old_logic = """        const activeBg = vrStyle
          ? 'linear-gradient(90deg, rgba(239,68,68,0.2), rgba(239,68,68,0.06))'
          : 'linear-gradient(90deg, rgba(245,158,11,0.2), rgba(245,158,11,0.06))'
        const activeBorder = vrStyle ? 'rgba(239,68,68,0.28)' : 'rgba(245,158,11,0.28)'"""
new_logic = """        const itemVrStyle = vrStyle || item.vrStyle
        const activeBg = itemVrStyle
          ? 'linear-gradient(90deg, rgba(239,68,68,0.2), rgba(239,68,68,0.06))'
          : 'linear-gradient(90deg, rgba(245,158,11,0.2), rgba(245,158,11,0.06))'
        const activeBorder = itemVrStyle ? 'rgba(239,68,68,0.28)' : 'rgba(245,158,11,0.28)'"""
content = content.replace(old_logic, new_logic)

old_render = """          {!compact && <span style={{ fontSize: '0.82rem', letterSpacing: '0.04em' }}>HOME</span>}
        </Link>
      </div>

      {/* Zone OS: MARKET OS */}"""

new_render = """          {!compact && <span style={{ fontSize: '0.82rem', letterSpacing: '0.04em' }}>HOME</span>}
        </Link>
      </div>

      {/* Top Hubs */}
      <NavLinks items={topHubItems} pathname={pathname} compact={compact} onNavigate={overlay ? onClose : undefined} />

      {/* Zone OS: MARKET OS */}"""
content = content.replace(old_render, new_render)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print(len(content))
