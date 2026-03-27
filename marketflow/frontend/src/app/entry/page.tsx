import React from 'react';
import Link from 'next/link';

export const metadata = {
  title: 'MarketFlow — Entry',
};

export default function EntryPage() {
  return (
    <div className="entry-layout">
      <style>{`
        /* Scoped to .entry-layout to avoid bleeding into ClientLayout/Sidebar */
        .entry-layout {
          --black: #050507;
          --white: #f0ede8;
          --gold: #c9a84c;
          --gold-dim: #7a6030;
          --red: #c0392b;
          --green: #27ae60;
          --accent: #e8d5a3;
          --border: rgba(201,168,76,0.18);
          --glass: rgba(255,255,255,0.03);

          background: var(--black);
          color: var(--white);
          font-family: 'Noto Serif KR', serif;
          min-height: 100vh;
          position: relative;
          overflow-x: hidden;
        }

        .entry-layout * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        .entry-layout::before {
          content: '';
          position: absolute; /* absolute instead of fixed to stay inside container */
          inset: 0;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E");
          pointer-events: none;
          z-index: 99;
          opacity: .55;
        }

        /* ── HEADER ── */
        .entry-layout header {
          position: sticky;
          top: 0;
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 48px;
          height: 64px;
          border-bottom: 1px solid var(--border);
          background: rgba(5,5,7,0.85);
          backdrop-filter: blur(12px);
        }

        .entry-layout .logo {
          display: flex; align-items: center; gap: 12px;
        }
        .entry-layout .logo-mark {
          width: 32px; height: 32px;
          border: 1.5px solid var(--gold);
          display: grid; place-items: center;
          font-family: 'Bebas Neue', sans-serif;
          font-size: 18px;
          color: var(--gold);
          letter-spacing: 1px;
        }
        .entry-layout .logo-name {
          font-family: 'DM Mono', monospace;
          font-size: 13px;
          font-weight: 500;
          letter-spacing: 3px;
          text-transform: uppercase;
          color: var(--white);
        }
        .entry-layout .logo-sub {
          font-family: 'DM Mono', monospace;
          font-size: 9px;
          color: var(--gold-dim);
          letter-spacing: 2px;
          text-transform: uppercase;
        }

        .entry-layout nav {
          display: flex; gap: 32px; align-items: center;
        }
        .entry-layout nav a {
          font-family: 'DM Mono', monospace;
          font-size: 11px;
          letter-spacing: 2px;
          text-transform: uppercase;
          color: rgba(240,237,232,0.45);
          text-decoration: none;
          transition: color .3s;
        }
        .entry-layout nav a:hover { color: var(--gold); }
        .entry-layout .nav-cta {
          padding: 7px 20px;
          border: 1px solid var(--gold);
          color: var(--gold) !important;
          font-size: 10px !important;
          letter-spacing: 2px !important;
          transition: background .3s !important;
          border-radius: 4px;
        }
        .entry-layout .nav-cta:hover { background: rgba(201,168,76,0.12) !important; }

        /* ── HERO ── */
        .entry-layout .hero {
          padding-top: 80px;
          padding-bottom: 40px;
          padding-left: 48px; padding-right: 48px;
          text-align: center;
        }

        .entry-layout .hero-eyebrow {
          font-family: 'DM Mono', monospace;
          font-size: 10px;
          letter-spacing: 4px;
          text-transform: uppercase;
          color: var(--gold-dim);
          margin-bottom: 20px;
          opacity: 0;
          animation: fadeUp .8s .2s forwards;
        }

        .entry-layout .hero-title {
          font-family: 'Bebas Neue', sans-serif;
          font-size: clamp(56px, 8vw, 112px);
          line-height: .95;
          letter-spacing: 2px;
          color: var(--white);
          opacity: 0;
          animation: fadeUp .9s .4s forwards;
        }
        .entry-layout .hero-title span { color: var(--gold); }

        .entry-layout .hero-rule {
          width: 60px; height: 1px;
          background: var(--gold);
          margin: 32px auto;
          opacity: 0;
          animation: fadeUp .6s .6s forwards;
        }

        .entry-layout .hero-sub {
          font-size: 15px;
          color: rgba(240,237,232,0.45);
          line-height: 1.8;
          max-width: 460px;
          margin: 0 auto;
          font-weight: 300;
          opacity: 0;
          animation: fadeUp .7s .7s forwards;
        }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* ── 4 CATEGORY GRID ── */
        .entry-layout .grid {
          display: flex;
          flex-direction: row;
          gap: 0;
          margin: 48px 48px 0;
          opacity: 0;
          animation: fadeUp .9s .9s forwards;
          align-items: stretch;
          flex-wrap: wrap; /* allow wrapping on small screens */
        }

        @media (max-width: 1024px) {
          .entry-layout .grid {
            flex-direction: column;
            gap: 20px;
          }
          .entry-layout .card-dash {
            display: none;
          }
        }

        /* dash connector between cards */
        .entry-layout .card-dash {
          display: flex; align-items: center; justify-content: center;
          width: 36px; flex-shrink: 0;
          color: rgba(201,168,76,0.35);
          font-family: 'DM Mono', monospace;
          font-size: 20px;
          user-select: none;
        }

        .entry-layout .card {
          background: var(--glass);
          border: 1px solid var(--border);
          position: relative;
          overflow: hidden;
          padding: 40px 28px 36px;
          cursor: pointer;
          transition: background .4s, border-color .4s;
          flex: 1;
          min-height: 280px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }
        .entry-layout .card:hover {
          background: rgba(201,168,76,0.05);
          border-color: rgba(201,168,76,0.4);
        }

        /* shimmer line on hover */
        .entry-layout .card::after {
          content: '';
          position: absolute; top: 0; left: -100%; width: 60%; height: 1px;
          background: linear-gradient(90deg, transparent, var(--gold), transparent);
          transition: left .6s ease;
        }
        .entry-layout .card:hover::after { left: 140%; }

        .entry-layout .card-num {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 80px;
          line-height: 1;
          color: rgba(201,168,76,0.05);
          position: absolute;
          bottom: 16px; right: 20px;
          pointer-events: none;
          transition: color .4s;
          letter-spacing: -2px;
        }
        .entry-layout .card:hover .card-num { color: rgba(201,168,76,0.13); }

        .entry-layout .card-icon {
          font-size: 24px;
          opacity: .75;
          flex-shrink: 0;
          width: 48px; height: 48px;
          border: 1px solid var(--border);
          display: grid; place-items: center;
          transition: border-color .3s;
          margin-bottom: 20px;
          border-radius: 4px;
        }
        .entry-layout .card:hover .card-icon { border-color: rgba(201,168,76,0.4); }

        .entry-layout .card-tag {
          font-family: 'DM Mono', monospace;
          font-size: 9px;
          letter-spacing: 3px;
          text-transform: uppercase;
          color: var(--gold);
          margin-bottom: 10px;
          display: flex; align-items: center; gap: 8px;
        }
        .entry-layout .card-tag::before {
          content: '';
          display: block;
          width: 14px; height: 1px;
          background: var(--gold);
          flex-shrink: 0;
        }

        .entry-layout .card-title {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 22px;
          letter-spacing: 1px;
          line-height: 1.15;
          color: var(--white);
          margin-bottom: 14px;
          white-space: nowrap;
        }

        .entry-layout .card-desc {
          font-size: 12px;
          color: rgba(240,237,232,0.38);
          line-height: 1.75;
          font-weight: 300;
        }

        .entry-layout .card-link {
          margin-top: 24px;
          font-family: 'DM Mono', monospace;
          font-size: 10px;
          letter-spacing: 2px;
          text-transform: uppercase;
          color: var(--gold);
          display: inline-flex; align-items: center; gap: 6px;
          text-decoration: none;
          opacity: 0;
          transform: translateY(6px);
          transition: opacity .3s, transform .3s;
        }
        .entry-layout .card:hover .card-link { opacity: 1; transform: translateY(0); }
        .entry-layout .card-link::after { content: '→'; transition: transform .3s; }
        .entry-layout .card:hover .card-link::after { transform: translateX(4px); }

        /* card colour accents */
        .entry-layout .card-1 .card-icon { color: #e8d5a3; }
        .entry-layout .card-2 .card-icon { color: #c0392b; }
        .entry-layout .card-3 .card-icon { color: #27ae60; }
        .entry-layout .card-4 .card-icon { color: #5b8ef0; }

        /* ── FOOTER ── */
        .entry-layout footer {
          padding: 28px 48px;
          display: flex; justify-content: space-between; align-items: center;
          border-top: 1px solid var(--border);
          opacity: 0;
          animation: fadeUp .6s 1.3s forwards;
          margin-top: 48px;
        }
        .entry-layout .footer-copy {
          font-family: 'DM Mono', monospace;
          font-size: 10px;
          color: rgba(240,237,232,0.2);
          letter-spacing: 1.5px;
        }
        .entry-layout .footer-status {
          display: flex; align-items: center; gap: 8px;
          font-family: 'DM Mono', monospace;
          font-size: 10px;
          color: rgba(240,237,232,0.3);
          letter-spacing: 1px;
        }
        .entry-layout .status-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: var(--green);
          animation: blink 2s ease-in-out infinite;
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }

        /* ── VERTICAL LABEL ── */
        .entry-layout .v-label {
          position: fixed; /* can be fixed for aesthetic since it's an overlay */
          left: 16px; top: 50%;
          transform: translateY(-50%) rotate(-90deg);
          transform-origin: center center;
          font-family: 'DM Mono', monospace;
          font-size: 9px;
          letter-spacing: 3px;
          color: rgba(201,168,76,0.25);
          text-transform: uppercase;
          pointer-events: none;
          z-index: 100;
        }

        @media (max-width: 768px) {
          .entry-layout header { padding: 0 24px; flex-direction: column; height: auto; padding-top: 16px; padding-bottom: 16px; gap: 16px; }
          .entry-layout nav { gap: 16px; flex-wrap: wrap; justify-content: center; }
          .entry-layout .hero { padding-left: 24px; padding-right: 24px; }
          .entry-layout .grid { margin: 24px 24px 0; }
          .entry-layout footer { padding: 24px; flex-direction: column; gap: 16px; text-align: center; }
          .entry-layout .v-label { display: none; }
        }
      `}</style>

      {/* Load fonts specifically for the Entry page */}
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@300;400;700&family=DM+Mono:ital,wght@0,300;0,500;1,300&family=Bebas+Neue&display=swap" rel="stylesheet" />

      {/* VERTICAL LABEL */}
      <div className="v-label">MarketFlow OS · 2025</div>

      {/* HEADER */}
      <header>
        <div className="logo">
          <div className="logo-mark">MF</div>
          <div>
            <div className="logo-name">MarketFlow</div>
            <div className="logo-sub">Institutional Grade</div>
          </div>
        </div>
        <nav>
          <Link href="/">시장 상태</Link>
          <Link href="/risk_v1">리스크 엔진</Link>
          <Link href="/portfolio">포트폴리오</Link>
          <Link href="/api/auth/signin" className="nav-cta">로그인 →</Link>
        </nav>
      </header>

      {/* HERO */}
      <div className="hero">
        <div className="hero-eyebrow">Capital OS · Institutional Intelligence</div>
        <h1 className="hero-title">Market<span>Flow</span></h1>
        <div className="hero-rule"></div>
        <p className="hero-sub">기관급 시장 분석과 리스크 관리 플랫폼.<br/>당신의 포지션을 정밀하게 보호합니다.</p>
      </div>

      {/* 4 CATEGORY GRID */}
      <div className="grid">
        {/* 1. 블룸버그 터미널 */}
        <Link href="/watchlist" className="card card-1" style={{ textDecoration: 'none' }}>
          <div>
            <div className="card-icon">◈</div>
            <div className="card-tag">01 · Terminal</div>
            <div className="card-title">블룸버그 터미널</div>
            <div className="card-desc">실시간 시세, 섹터 순환, 지수·금리·환율·원자재까지 — 기관급 마켓 데이터를 하나의 뷰로 통합합니다.</div>
          </div>
          <div className="card-link">진입하기</div>
          <div className="card-num">01</div>
        </Link>

        <div className="card-dash">—</div>

        {/* 2. 리스크 엔진 */}
        <Link href="/crash" className="card card-2" style={{ textDecoration: 'none' }}>
          <div>
            <div className="card-icon">⬡</div>
            <div className="card-tag">02 · Risk</div>
            <div className="card-title">리스크 엔진</div>
            <div className="card-desc">VCP 신호, 충격률 분석, 방어 모드 판단. 포지션 위험을 실시간으로 계량화하고 선제 대응합니다.</div>
          </div>
          <div className="card-link">진입하기</div>
          <div className="card-num">02</div>
        </Link>

        <div className="card-dash">—</div>

        {/* 3. 레버리지 렌즈 */}
        <Link href="/crash/navigator" className="card card-3" style={{ textDecoration: 'none' }}>
          <div>
            <div className="card-icon">◎</div>
            <div className="card-tag">03 · Leverage</div>
            <div className="card-title">레버리지 렌즈</div>
            <div className="card-desc">레버리지 배율 가이드, 노출 범위 설정, 환경 적합도 측정. 과도한 리스크 없이 수익 구조를 설계합니다.</div>
          </div>
          <div className="card-link">진입하기</div>
          <div className="card-num">03</div>
        </Link>

        <div className="card-dash">—</div>

        {/* 4. 개인자산관리 */}
        <Link href="/portfolio" className="card card-4" style={{ textDecoration: 'none' }}>
          <div>
            <div className="card-icon">▣</div>
            <div className="card-tag">04 · Wealth</div>
            <div className="card-title">개인자산관리</div>
            <div className="card-desc">포트폴리오 통합, AI 마켓 브리프, 포지셔닝 결론. 나만의 자산 전략을 하나의 대시보드로 관리합니다.</div>
          </div>
          <div className="card-link">진입하기</div>
          <div className="card-num">04</div>
        </Link>
      </div>

      {/* FOOTER */}
      <footer>
        <div className="footer-copy">© 2025 MarketFlow · Capital OS · Institutional Grade Platform</div>
        <div className="footer-status">
          <div className="status-dot"></div>
          실시간 데이터 연결됨
        </div>
      </footer>
    </div>
  );
}
