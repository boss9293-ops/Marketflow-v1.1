import sys

file_path = r'd:\Youtube_pro\000-Code_develop\주식분석\us_market_complete\marketflow\frontend\src\components\Sidebar.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read().replace('\r\n', '\n')

old_os = """// ── Zone OS: Market OS ────────────────────────────────────────────────────────
const osItems = [
  { href: '/context',             label: { ko: '시장 컨텍스트', en: 'Market Context' },       subLabel: { ko: '환경·구조·상태 해석', en: 'Environment/Structure/State' }, dot: '#93c5fd' },
  { href: '/state',               label: { ko: '시장 상태',     en: 'Market State' },         subLabel: { ko: '오늘의 상태',         en: 'Current State' },              dot: '#c4ff0d' },
  { href: '/health',              label: { ko: '시장 건강',     en: 'Market Health' },        subLabel: { ko: '구조 진단',           en: 'Structural Diagnostic' },      dot: '#00D9FF' },
  { href: '/macro',               label: { ko: '매크로',        en: 'Macro Layer' },          subLabel: { ko: '환경 압력',           en: 'Environment Pressure' },       dot: '#38bdf8' },
  { href: '/opportunity-signals', label: { ko: '기회 신호',     en: 'Opportunity Signals' },  subLabel: { ko: 'VCP',                 en: 'Pattern Scanner' },            dot: '#22c55e', icon: 'scan' as const },
  { href: '/sectors',             label: { ko: '섹터',          en: 'Sectors' },                                                                                          dot: '#14b8a6' },
  { href: '/briefing',            label: { ko: '데일리 브리핑', en: 'Briefing' },                                                                                         dot: '#a855f7' },
  { href: '/chart',               label: { ko: '주식분석',      en: 'Stock Analysis' },       subLabel: { ko: '차트 · 종목 분석',    en: 'Chart & Ticker' },             dot: '#22d3ee' },
]"""

new_os = """// ── Zone OS: Market OS ────────────────────────────────────────────────────────
const osItems = [
  { href: '/briefing',            label: { ko: '데일리 브리핑', en: 'Briefing' },                                                                                         dot: '#a855f7' },
  { href: '/macro',               label: { ko: '매크로',        en: 'Macro Layer' },          subLabel: { ko: '환경 압력',           en: 'Environment Pressure' },       dot: '#38bdf8' },
  { href: '/chart',               label: { ko: '주식분석',      en: 'Stock Analysis' },       subLabel: { ko: '차트 · 종목 분석',    en: 'Chart & Ticker' },             dot: '#22d3ee' },
  { href: '/sectors',             label: { ko: '섹터',          en: 'Sectors' },                                                                                          dot: '#14b8a6' },
]"""
content = content.replace(old_os, new_os)

old_to = """// ── Zone TO: Tools ───────────────────────────────────────────────────────────
const toolItems = [
  { href: '/calendar', label: { ko: '캘린더',         en: 'Calendar' },         dot: '#84cc16' },
  { href: '/lab',      label: { ko: '랩(프로)',        en: 'Lab (Pro)' },        dot: '#f472b6', subLabel: { ko: 'Crash/Research', en: 'Crash/Research' } },
  {
    href: '/smart-money',
    label: { ko: 'Smart Flow Index', en: 'Smart Flow Index' },
    subLabel: { ko: '프록시 플로우 지수', en: 'Proxy flow index' },
    dot: '#38bdf8',
    tooltip: '기관 데이터(13F)가 아닌 거래량·상대강도·추세의 프록시\\n레짐 적합 시 참고용',
  },
]"""

new_to = """// ── Zone TO: Tools ───────────────────────────────────────────────────────────
const toolItems = [
  { href: '/opportunity-signals', label: { ko: '기회 신호',     en: 'Opportunity Signals' },  subLabel: { ko: 'VCP',                 en: 'Pattern Scanner' },            dot: '#22c55e', icon: 'scan' as const },
  { href: '/calendar', label: { ko: '캘린더',         en: 'Calendar' },         dot: '#84cc16' },
  { href: '/lab',      label: { ko: '랩(프로)',        en: 'Lab (Pro)' },        dot: '#f472b6', subLabel: { ko: 'Crash/Research', en: 'Crash/Research' } },
  {
    href: '/smart-money',
    label: { ko: 'Smart Flow Index', en: 'Smart Flow Index' },
    subLabel: { ko: '프록시 플로우 지수', en: 'Proxy flow index' },
    dot: '#38bdf8',
    tooltip: '기관 데이터(13F)가 아닌 거래량·상대강도·추세의 프록시\\n레짐 적합 시 참고용',
  },
]"""
content = content.replace(old_to, new_to)


with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Done replacing OS and TO items")

