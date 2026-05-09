'use client'
import React, { useState, useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, LineChart, Line, ReferenceLine, ComposedChart
} from 'recharts';
import {
  Zap, AlertTriangle, History, Target,
  Activity, Shield, TrendingUp, Layers, Cpu,
  PlayCircle, Download,
  Database, Globe, BarChart4
} from 'lucide-react';

const generateTerminalData = (inspectionIndex = 100) => {
  const history = Array.from({ length: 120 }).map((_, i) => ({
    date: `2024-${String(Math.floor(i/30) + 1).padStart(2, '0')}-${String((i%30) + 1).padStart(2, '0')}`,
    soxx: 180 + i * 0.5 + Math.sin(i/5) * 10,
    bucket: 175 + i * 0.45 + Math.sin(i/6) * 8,
    inventory: 40 + Math.cos(i/10) * 15,
    demand: 60 + Math.sin(i/12) * 20,
    score: 50 + Math.sin(i/8) * 30,
  }));

  const current = history[Math.min(inspectionIndex, history.length - 1)];

  return {
    as_of: current.date,
    inspection_point: inspectionIndex,
    history,
    kpis: {
      engine_score: Math.round(current.score),
      strategy_score: Math.round(current.score * 0.9),
      stage: current.score > 70 ? 'PEAK' : current.score > 40 ? 'EXPANSION' : 'EARLY',
      conflict: current.score > 80 ? 'STRONG' : 'NONE',
      risk: current.score > 70 ? 'CAUTION' : current.score < 30 ? 'AVOID' : 'ENTER',
    },
    signals: {
      spread: (current.soxx - current.bucket).toFixed(2),
      correlation: 0.92,
      breadth: { adv: 24, dec: 6, ratio: '4.0x' },
      leaders: [
        { ticker: 'NVDA', weight: '22.4%', contrib: '+1.2%', flow: 'BULL' },
        { ticker: 'TSM', weight: '15.1%', contrib: '+0.8%', flow: 'NEUTRAL' },
        { ticker: 'AVGO', weight: '12.0%', contrib: '+0.5%', flow: 'BULL' },
        { ticker: 'ASML', weight: '10.5%', contrib: '-0.2%', flow: 'BEAR' },
        { ticker: 'AMD', weight: '8.2%', contrib: '+0.1%', flow: 'BULL' },
      ]
    },
    macro: {
      rates: '5.25%',
      liquidity: 'CONTRACTION',
      inventory_state: 'NORMALIZING'
    }
  };
};

const KPIBox = ({ label, value, subValue, state }: {
  label: string; value: any; subValue?: string; state?: string;
}) => {
  const stateColor = ({
    ENTER: 'text-emerald-500',
    CAUTION: 'text-orange-500',
    AVOID: 'text-red-500',
    NONE: 'text-slate-500',
    STRONG: 'text-red-500',
    PEAK: 'text-purple-400'
  } as Record<string, string>)[state ?? ''] || 'text-blue-400';

  return (
    <div className="flex flex-col border-r border-slate-800 px-6 first:pl-0 last:border-0 min-w-[140px]">
      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter mb-1">{label}</span>
      <div className="flex items-baseline gap-2">
        <span className={`font-mono text-2xl font-black ${stateColor}`}>{value}</span>
        {subValue && <span className="text-[10px] font-bold text-slate-500">{subValue}</span>}
      </div>
      <div className="mt-1 h-1 w-full bg-slate-800/50 rounded-full overflow-hidden">
        <div className={`h-full bg-current ${stateColor}`} style={{ width: typeof value === 'number' ? `${value}%` : '100%' }} />
      </div>
    </div>
  );
};

const SectionHeader = ({ title, icon: Icon }: { title: string; icon?: any }) => (
  <div className="flex items-center gap-2 mb-4 border-b border-slate-800 pb-2">
    {Icon && <Icon size={14} className="text-blue-500" />}
    <h3 className="text-[11px] font-bold text-slate-300 uppercase tracking-widest">{title}</h3>
  </div>
);

const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-[#0a0f1e] border border-slate-800 p-4 ${className}`}>
    {children}
  </div>
);

export default function SemiconductorRiskPanel() {
  const [activeTab, setActiveTab] = useState('ENGINE');
  const [inspectionIndex, setInspectionIndex] = useState(100);
  const data = useMemo(() => generateTerminalData(inspectionIndex), [inspectionIndex]);

  const { kpis, signals, history, macro } = data;

  return (
    <div className="flex h-screen flex-col bg-[#050810] font-sans text-slate-300 select-none">

      <header className="flex items-center justify-between border-b border-slate-800 bg-[#0a0f1e] px-6 py-3 shrink-0">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2 mr-4">
            <div className="h-6 w-6 bg-blue-600 flex items-center justify-center rounded-sm">
              <Cpu size={14} className="text-white" />
            </div>
            <span className="text-xs font-black tracking-tighter text-white">SEMI_ENGINE <span className="text-slate-600 font-normal">v3.0.0</span></span>
          </div>
          <div className="flex items-center">
            <KPIBox label="Engine Score" value={kpis.engine_score} state={kpis.risk} />
            <KPIBox label="Strategy Score" value={kpis.strategy_score} state={kpis.risk} />
            <KPIBox label="Current Stage" value={kpis.stage} state={kpis.stage} />
            <KPIBox label="Conflict Mode" value={kpis.conflict} state={kpis.conflict} />
            <KPIBox label="Risk State" value={kpis.risk} state={kpis.risk} />
          </div>
        </div>
        <div className="flex items-center gap-4 text-slate-500 font-mono text-[10px]">
          <div className="flex flex-col text-right">
            <span>TERMINAL_SYNC: OK</span>
            <span>{data.as_of}</span>
          </div>
          <button className="p-2 hover:bg-slate-800 transition-colors border border-slate-800">
            <Download size={14} />
          </button>
        </div>
      </header>

      <nav className="flex bg-[#0a0f1e] border-b border-slate-800 px-6 shrink-0">
        {['MASTER', 'ENGINE', 'STRATEGY'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-8 py-3 text-[10px] font-bold tracking-[0.2em] transition-all border-b-2 ${
              activeTab === tab
              ? 'border-blue-500 text-white bg-blue-500/5'
              : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            {tab}
          </button>
        ))}
      </nav>

      <main className="flex-1 overflow-hidden flex">

        <aside className="w-1/4 border-r border-slate-800 overflow-y-auto p-5 space-y-6">
          <div>
            <SectionHeader title="Cycle Context" icon={Layers} />
            <Card className="bg-blue-500/5 border-blue-500/20">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-full border-2 border-blue-500 flex items-center justify-center font-black text-blue-500">
                  {kpis.engine_score}
                </div>
                <div>
                  <div className="text-xs font-bold text-white uppercase">{kpis.stage} PHASE</div>
                  <div className="text-[10px] text-slate-500">Regime stability: HIGH</div>
                </div>
              </div>
              <p className="text-[10px] leading-relaxed text-slate-400 italic">
                ?꾩옱 ?붿쭊? {kpis.stage} 援?㈃???곗씠?곕? ?좊컲??以묒엯?덈떎. {macro.inventory_state} ?곹깭媛 吏?띾맖???곕씪 由ъ뒪???깃툒? {kpis.risk}?쇰줈 ?좎??⑸땲??
              </p>
            </Card>
          </div>

          <div>
            <SectionHeader title="Macro Overlay" icon={Globe} />
            <div className="space-y-1">
              <div className="flex justify-between py-2 border-b border-slate-800/50">
                <span className="text-[10px] text-slate-500">Fed Funds Rate</span>
                <span className="text-[10px] font-mono font-bold text-white">{macro.rates}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-800/50">
                <span className="text-[10px] text-slate-500">Global Liquidity</span>
                <span className="text-[10px] font-mono font-bold text-red-400">{macro.liquidity}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-800/50">
                <span className="text-[10px] text-slate-500">Inventory Status</span>
                <span className="text-[10px] font-mono font-bold text-blue-400">{macro.inventory_state}</span>
              </div>
            </div>
          </div>

          <div>
            <SectionHeader title="Risk Label Logic" icon={Shield} />
            <div className="space-y-3">
              <div className={`p-2 border-l-2 text-[10px] ${kpis.risk === 'ENTER' ? 'border-emerald-500 bg-emerald-500/5' : 'border-slate-700'}`}>
                <span className="font-black block mb-1 uppercase">ENTER (Bullish)</span>
                Structural expansion + High Demand
              </div>
              <div className={`p-2 border-l-2 text-[10px] ${kpis.risk === 'CAUTION' ? 'border-orange-500 bg-orange-500/5' : 'border-slate-700'}`}>
                <span className="font-black block mb-1 uppercase">CAUTION (Watch)</span>
                Valuation heat + Momentum divergence
              </div>
              <div className={`p-2 border-l-2 text-[10px] ${kpis.risk === 'AVOID' ? 'border-red-500 bg-red-500/5' : 'border-slate-700'}`}>
                <span className="font-black block mb-1 uppercase">AVOID (Bearish)</span>
                Inventory buildup + Cycle peak confirmed
              </div>
            </div>
          </div>
        </aside>

        <section className="w-1/2 overflow-y-auto p-5 space-y-6">

          {activeTab === 'ENGINE' && (
            <>
              <Card>
                <div className="flex justify-between items-center mb-6">
                  <SectionHeader title="SOXX vs Bucket Composite Ratio" icon={Activity} />
                  <div className="flex items-center gap-4 text-[10px] font-mono">
                    <span className="flex items-center gap-1 text-blue-400"><span className="h-1.5 w-1.5 bg-blue-400" /> SOXX</span>
                    <span className="flex items-center gap-1 text-slate-500"><span className="h-1.5 w-1.5 bg-slate-500" /> BUCKET</span>
                  </div>
                </div>
                <div className="h-[320px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={history.slice(Math.max(0, inspectionIndex - 30), inspectionIndex)}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                      <XAxis dataKey="date" hide />
                      <YAxis domain={['auto', 'auto']} axisLine={false} tickLine={false} tick={{fill: '#475569', fontSize: 10}} />
                      <Tooltip contentStyle={{backgroundColor: '#0f172a', border: '1px solid #334155'}} />
                      <Area type="monotone" dataKey="bucket" fill="#334155" fillOpacity={0.1} stroke="#475569" strokeWidth={1} />
                      <Line type="monotone" dataKey="soxx" stroke="#3b82f6" strokeWidth={3} dot={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-slate-800 pt-4">
                   <div className="text-[10px]">
                      <span className="text-slate-500 uppercase">Spread (Price-Value): </span>
                      <span className="font-mono font-bold text-white">{signals.spread} pts</span>
                   </div>
                   <div className="text-[10px]">
                      <span className="text-slate-500 uppercase">Correlation: </span>
                      <span className="font-mono font-bold text-emerald-500">{signals.correlation}</span>
                   </div>
                </div>
              </Card>

              <div className="grid grid-cols-2 gap-6">
                <Card>
                  <SectionHeader title="Factor Contribution" icon={BarChart4} />
                  <div className="h-[180px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={[
                        { name: 'AI Infra', val: 45 },
                        { name: 'Memory', val: 28 },
                        { name: 'Logic', val: 12 },
                        { name: 'Auto', val: -5 }
                      ]}>
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#475569', fontSize: 10}} />
                        <YAxis hide />
                        <Bar dataKey="val" radius={[2, 2, 0, 0]}>
                          {[0,1,2,3].map((_, index) => (
                            <Cell key={index} fill={index === 0 ? '#3b82f6' : '#1e293b'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
                <Card>
                  <SectionHeader title="Momentum Heatmap" icon={Zap} />
                  <div className="grid grid-cols-5 gap-1">
                    {Array.from({length: 25}).map((_, i) => (
                      <div key={i} className={`h-8 rounded-sm ${i < 15 ? 'bg-emerald-500/20' : 'bg-slate-800/30'}`} />
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-600 mt-4 uppercase tracking-tighter">Cluster analysis: Positive drift detected in top-tier logic bucket</p>
                </Card>
              </div>
            </>
          )}

          {activeTab === 'MASTER' && (
            <Card>
              <SectionHeader title="Supply / Demand Structural Balance" icon={Database} />
              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={history}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                    <XAxis dataKey="date" hide />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#475569', fontSize: 10}} />
                    <Tooltip contentStyle={{backgroundColor: '#0f172a', border: '1px solid #334155'}} />
                    <Area type="monotone" dataKey="demand" stackId="1" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} />
                    <Area type="monotone" dataKey="inventory" stackId="1" stroke="#f43f5e" fill="#f43f5e" fillOpacity={0.1} />
                    <ReferenceLine x={history[inspectionIndex]?.date} stroke="#fff" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 text-[10px] text-slate-500 italic">
                * Structural deficits typically lead price by 2 quarters. Current projection indicates {kpis.stage} sustainability.
              </div>
            </Card>
          )}

          {activeTab === 'STRATEGY' && (
            <div className="space-y-6">
              <Card>
                <SectionHeader title="Scenario Probability Engine" icon={Target} />
                <div className="grid grid-cols-3 gap-6 pt-4">
                  <div className="text-center p-4 border border-slate-800 bg-slate-900/20">
                    <div className="text-[10px] text-slate-500 uppercase font-black">Bear</div>
                    <div className="text-2xl font-mono font-black text-red-500">12%</div>
                  </div>
                  <div className="text-center p-4 border border-blue-500/30 bg-blue-500/10 scale-105">
                    <div className="text-[10px] text-blue-400 uppercase font-black">Base</div>
                    <div className="text-2xl font-mono font-black text-white">65%</div>
                  </div>
                  <div className="text-center p-4 border border-slate-800 bg-slate-900/20">
                    <div className="text-[10px] text-slate-500 uppercase font-black">Bull</div>
                    <div className="text-2xl font-mono font-black text-emerald-500">23%</div>
                  </div>
                </div>
              </Card>

              <Card>
                <SectionHeader title="Historical Analog Matches" icon={History} />
                <div className="space-y-4">
                  {[
                    { year: '2020 Q3', match: '94%', result: 'Expansion (Bullish)' },
                    { year: '2016 Q2', match: '82%', result: 'Recovery (Bullish)' },
                    { year: '2008 Q1', match: '45%', result: 'Bubble Peak (Bearish)' },
                  ].map((analog, i) => (
                    <div key={i} className="flex items-center justify-between p-3 border border-slate-800/50 hover:bg-white/5 transition-colors cursor-pointer">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-white">{analog.year}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-400">Match: {analog.match}</span>
                      </div>
                      <span className="text-[10px] font-bold text-slate-500">{analog.result}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}
        </section>

        <aside className="w-1/4 border-l border-slate-800 overflow-y-auto p-5 space-y-6">
          <div>
            <SectionHeader title="Signal Stack" icon={Activity} />
            <div className="space-y-2">
              <div className="flex justify-between items-center p-2 bg-slate-900/40 border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase">Breadth (Adv/Dec)</span>
                <span className="text-[11px] font-bold text-emerald-500">{signals.breadth.ratio}</span>
              </div>
              <div className="flex justify-between items-center p-2 bg-slate-900/40 border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase">Liquidity Signal</span>
                <span className="text-[11px] font-bold text-red-400">TIGHTENING</span>
              </div>
              <div className="flex justify-between items-center p-2 bg-slate-900/40 border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase">Volatility (Implied)</span>
                <span className="text-[11px] font-bold text-orange-400">SPIKE_RISK</span>
              </div>
            </div>
          </div>

          <div>
            <SectionHeader title="Top 5 Leader Contribution" icon={TrendingUp} />
            <table className="w-full text-[10px]">
              <thead className="text-slate-500 border-b border-slate-800">
                <tr className="uppercase tracking-tighter">
                  <th className="py-2 text-left font-normal">Asset</th>
                  <th className="py-2 text-right font-normal">Weight</th>
                  <th className="py-2 text-right font-normal">Contrib</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/30 font-mono">
                {signals.leaders.map((leader, i) => (
                  <tr key={i} className="hover:bg-white/5 transition-colors cursor-crosshair">
                    <td className="py-3 font-bold text-white">{leader.ticker}</td>
                    <td className="py-3 text-right text-slate-400">{leader.weight}</td>
                    <td className={`py-3 text-right font-bold ${leader.contrib.startsWith('+') ? 'text-emerald-500' : 'text-red-500'}`}>
                      {leader.contrib}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Card className="border-orange-500/20 bg-orange-500/5">
            <h4 className="text-[10px] font-black text-orange-500 uppercase mb-2 flex items-center gap-2">
              <AlertTriangle size={12} />
              Engine Contradiction Signal
            </h4>
            <p className="text-[10px] leading-relaxed text-slate-400 italic">
              "Logic ?뱁꽣??紐⑤찘?? 媛뺥솕?섍퀬 ?덉쑝?? 留ㅽ겕濡??좊룞??吏?쒕뒗 ?섏텞 援?㈃?쇰줈 吏꾩엯?덉뒿?덈떎. 媛寃?媛移??ㅽ봽?덈뱶 ?뺣?瑜?紐⑤땲?곕쭅 ?섏떗?쒖삤."
            </p>
          </Card>
        </aside>
      </main>

      <footer className="border-t border-slate-800 bg-[#0a0f1e] px-6 py-4 shrink-0">
        <div className="flex flex-col gap-3">
          <div className="flex justify-between items-center text-[10px] font-mono font-bold text-slate-500">
             <div className="flex items-center gap-2">
                <PlayCircle size={14} className="text-blue-500 cursor-pointer" />
                <span className="uppercase">Historical Inspection Mode</span>
             </div>
             <span className="text-blue-400">POINT: {inspectionIndex} / 120 (T-{(120-inspectionIndex)}D)</span>
          </div>
          <div className="relative group">
            <input
              type="range"
              min="1"
              max="119"
              value={inspectionIndex}
              onChange={(e) => setInspectionIndex(parseInt(e.target.value))}
              className="w-full h-1 bg-slate-800 rounded-full appearance-none cursor-pointer accent-blue-500 group-hover:h-2 transition-all"
            />
            <div className="absolute -top-1 left-0 w-full flex justify-between pointer-events-none opacity-20">
               {Array.from({length: 12}).map((_, i) => (
                 <div key={i} className="w-px h-3 bg-slate-500" />
               ))}
            </div>
          </div>
          <div className="flex justify-between items-center text-[10px] text-slate-600 uppercase tracking-widest font-mono">
            <span>2024-01-01</span>
            <div className="flex gap-4">
              <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> SYNCED</span>
              <span>API_VERSION: 3.0.0_STABLE</span>
            </div>
            <span>PRESENT (AUTO_SYNC)</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
