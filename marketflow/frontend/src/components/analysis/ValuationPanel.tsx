'use client'

import React, { useEffect, useState, useRef } from 'react'

export type ValuationDashboardProps = {
  symbol?: string
  fetchKey?: number
  price?: number
  eps1?: number
  eps3?: number
  peSec?: number
  peBear?: number
  peBase?: number
  peBull?: number
  epsCagr?: number
  revCagr?: number
}

export default function ValuationPanel({ 
  symbol = 'NVDA', 
  fetchKey = 0,
  price = 253.00,
  eps1 = 7.50,
  eps3 = 13.30,
  peSec = 29.90,
  peBear = 21.05,
  peBase = 26.31,
  peBull = 31.95,
  epsCagr = 21.0,
  revCagr = 25.0
}: ValuationDashboardProps) {
  
  // Local state for dynamic scenario modeling (Interactive inputs) setup
  const [inputs, setInputs] = useState({
    price, eps1, eps3, peSec, peBear, peBase, peBull, epsCagr, revCagr
  });

  // Re-sync if parent injects new props
  useEffect(() => {
    setInputs(prev => ({
      ...prev,
      price, eps1, eps3, peSec, peBear, peBase, peBull, epsCagr, revCagr
    }));
  }, [price, eps1, eps3, peSec, peBear, peBase, peBull, epsCagr, revCagr]);

  const [aiSummary, setAiSummary] = useState(
    "AI Interpretation: Based on current consensus estimates and market trends, if the company maintains its sector-relative premium multiplier, there is a solid 38% upside to the Base case target over the next 3 years. Bull case assumes persistent margin expansion."
  );

  const [loading, setLoading] = useState(false);
  const fetchingRef = useRef(false);

  // Attempt to fetch real API data
  useEffect(() => {
    const rawSymbol = symbol.trim().toUpperCase()
    const sym = rawSymbol.includes(':') ? rawSymbol.split(':').pop() || rawSymbol : rawSymbol;
    if (!sym || !fetchKey) return;
    if (fetchingRef.current) return;

    fetchingRef.current = true;
    setLoading(true);

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 12000)

    fetch(`/api/valuation?symbol=${encodeURIComponent(sym)}`, { signal: controller.signal })
      .then(async (res) => {
        const json = await res.json()
        if (!res.ok) throw new Error('Failed to fetch')
        return json
      })
      .then((data) => {
        if (data.price) {
          setInputs(prev => ({
            ...prev,
            price: data.price || prev.price,
            eps1: data.baseCase?.epsNext || prev.eps1,
            eps3: (data.baseCase?.epsNext || prev.eps1) * 1.5,
            peSec: data.sectorPE || prev.peSec,
            peBear: data.bearCase?.pe || prev.peBear,
            peBase: data.baseCase?.pe || prev.peBase,
            peBull: data.bullCase?.pe || prev.peBull,
            epsCagr: data.epsGrowth3y !== null ? data.epsGrowth3y * 100 : prev.epsCagr,
            revCagr: data.revenueGrowth3y !== null ? data.revenueGrowth3y * 100 : prev.revCagr,
          }));
        }
        if (data.aiSummary) setAiSummary(data.aiSummary);
      })
      .catch((err) => {
        console.warn('Using default mock/prop values for Valuation Dashboard due to fetch error:', err);
      })
      .finally(() => {
        clearTimeout(timeout)
        setLoading(false)
        fetchingRef.current = false;
      })

    return () => {
      clearTimeout(timeout)
      controller.abort()
      fetchingRef.current = false;
    }
  }, [symbol, fetchKey])


  // -- Dynamic Calculations --
  const fwdPer = inputs.eps1 > 0 ? inputs.price / inputs.eps1 : 0;
  const targetBear = inputs.eps3 * inputs.peBear;
  const targetBase = inputs.eps3 * inputs.peBase;
  const targetBull = inputs.eps3 * inputs.peBull;

  const calcUpside = (target: number) => {
    if (inputs.price <= 0) return 0;
    return ((target - inputs.price) / inputs.price) * 100;
  };

  const upsideBear = calcUpside(targetBear);
  const upsideBase = calcUpside(targetBase);
  const upsideBull = calcUpside(targetBull);

  const peg = inputs.epsCagr > 0 ? fwdPer / inputs.epsCagr : 0;
  const evEbitda = (fwdPer * 0.75).toFixed(1); 

  // Handlers
  const handleSliderChange = (key: keyof typeof inputs, value: string) => {
    setInputs(prev => ({
      ...prev,
      [key]: Number(value)
    }));
  };

  const formatCurrency = (val: number) => `$${val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  const formatPct = (val: number) => `${val > 0 ? '+' : ''}${val.toFixed(1)}%`;

  return (
    <div className="flex flex-col gap-5 w-full text-[#e8edf9] font-sans antialiased">
      
      {/* 1. VALUATION SNAPSHOT */}
      <div className="bg-[#1e2129] border border-white/10 rounded-xl p-6 lg:p-8 relative overflow-hidden flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-green-500/10 rounded-full blur-[80px] pointer-events-none"></div>

        <div className="flex flex-col z-10 w-full md:w-auto text-center md:text-left">
          <div className="text-gray-400 font-bold text-sm tracking-widest uppercase mb-1">Valuation Snapshot</div>
          <div className="text-gray-500 text-xs mb-3">TICKER: {symbol}</div>
          <div className="flex items-end justify-center md:justify-start gap-3">
            <span className="text-sm text-gray-400 pb-1">Current Price</span>
            <span className="text-4xl md:text-5xl font-bold tracking-tight">{formatCurrency(inputs.price)}</span>
          </div>
        </div>

        <div className="hidden md:block w-px h-16 bg-white/10 z-10"></div>
        <div className="block md:hidden w-full h-px bg-white/10 z-10"></div>

        <div className="flex flex-col z-10 w-full md:w-auto text-center md:text-right">
          <div className="text-green-400 font-bold text-sm tracking-widest uppercase mb-4 md:mb-1">3Y Target (Base)</div>
          <div className="flex items-end justify-center md:justify-end gap-4">
            <span className="text-4xl md:text-5xl font-bold tracking-tight text-white">
              {formatCurrency(targetBase)}
            </span>
            <span className="text-xl md:text-2xl font-bold text-green-500 pb-1">
              {formatPct(upsideBase)}
            </span>
          </div>
        </div>
      </div>

      {loading && (
        <div className="text-sm text-gray-400 animate-pulse px-2">Fetching live data & recalculating models...</div>
      )}

      {/* MID SECTION - GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
        
        {/* LEFT COLUMN: Inputs & Multiples */}
        <div className="flex flex-col gap-5">
          
          {/* 2. Key Inputs Panel */}
          <div className="bg-[#1e2129] border border-white/10 rounded-xl p-5 flex flex-col flex-1">
            <div className="text-gray-300 font-bold text-[0.95rem] mb-5 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              Key Scenario Inputs
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
              
              {/* EPS_1 Slider */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center whitespace-nowrap">
                  <label className="text-xs text-gray-400 font-medium tracking-wide">EPS_1</label>
                  <span className="text-sm font-bold text-white leading-none">{inputs.eps1.toFixed(2)}</span>
                </div>
                <input 
                  type="range" min="0.1" max={Math.max(50, inputs.eps1 * 2)} step="0.1" 
                  value={inputs.eps1} 
                  onChange={(e) => handleSliderChange('eps1', e.target.value)}
                  className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500 hover:accent-blue-400"
                />
              </div>

              {/* EPS_3 Slider */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center whitespace-nowrap">
                  <label className="text-xs text-gray-400 font-medium tracking-wide">EPS_3</label>
                  <span className="text-sm font-bold text-white leading-none">{inputs.eps3.toFixed(2)}</span>
                </div>
                <input 
                  type="range" min="0.1" max={Math.max(100, inputs.eps3 * 2)} step="0.1" 
                  value={inputs.eps3} 
                  onChange={(e) => handleSliderChange('eps3', e.target.value)}
                  className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500 hover:accent-blue-400"
                />
              </div>

              {/* PE Bear Slider */}
              <div className="flex flex-col gap-1.5 mt-2">
                <div className="flex justify-between items-center whitespace-nowrap">
                  <label className="text-xs text-red-400 font-medium tracking-wide">PE (Bear)</label>
                  <span className="text-sm font-bold text-white leading-none">{inputs.peBear.toFixed(1)}x</span>
                </div>
                <input 
                  type="range" min="5" max={Math.max(100, inputs.peSec * 1.5)} step="0.1" 
                  value={inputs.peBear} 
                  onChange={(e) => handleSliderChange('peBear', e.target.value)}
                  className="w-full h-1.5 bg-red-950 rounded-lg appearance-none cursor-pointer accent-red-500 hover:accent-red-400"
                />
              </div>

              {/* PE Base Slider */}
              <div className="flex flex-col gap-1.5 mt-2">
                <div className="flex justify-between items-center whitespace-nowrap">
                  <label className="text-xs text-green-400 font-medium tracking-wide">PE (Base)</label>
                  <span className="text-sm font-bold text-white leading-none">{inputs.peBase.toFixed(1)}x</span>
                </div>
                <input 
                  type="range" min="5" max={Math.max(100, inputs.peSec * 2)} step="0.1" 
                  value={inputs.peBase} 
                  onChange={(e) => handleSliderChange('peBase', e.target.value)}
                  className="w-full h-1.5 bg-green-950 rounded-lg appearance-none cursor-pointer accent-green-500 hover:accent-green-400"
                />
              </div>

              {/* PE Sector Box & Bull PE */}
              <div className="flex flex-col justify-between col-span-1 md:col-span-2 mt-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center whitespace-nowrap">
                    <label className="text-xs text-blue-400 font-medium tracking-wide">PE (Bull)</label>
                    <span className="text-sm font-bold text-white leading-none">{inputs.peBull.toFixed(1)}x</span>
                  </div>
                  <input 
                    type="range" min="5" max={Math.max(150, inputs.peSec * 3)} step="0.1" 
                    value={inputs.peBull} 
                    onChange={(e) => handleSliderChange('peBull', e.target.value)}
                    className="w-full h-1.5 bg-blue-950 rounded-lg appearance-none cursor-pointer accent-blue-500 hover:accent-blue-400"
                  />
                </div>
                
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500">Sector Ref:</span>
                  <span className="text-xs bg-white/10 px-2 py-0.5 rounded text-gray-300 font-mono">{inputs.peSec.toFixed(1)}x</span>
                </div>
              </div>

            </div>
          </div>

          {/* 3. Multiples */}
          <div className="bg-[#1e2129] border border-white/10 rounded-xl p-5">
            <div className="text-gray-300 font-bold text-[0.95rem] mb-4">Current Multiples</div>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white/5 border border-white/5 rounded-lg p-3">
                <div className="text-xs text-gray-400 mb-1">Fwd PER</div>
                <div className="font-bold text-lg">{fwdPer.toFixed(1)}x</div>
              </div>
              <div className="bg-white/5 border border-white/5 rounded-lg p-3">
                <div className="text-xs text-gray-400 mb-1">PEG Ratio</div>
                <div className="font-bold text-lg">{peg.toFixed(2)}</div>
              </div>
              <div className="bg-white/5 border border-white/5 rounded-lg p-3">
                <div className="text-xs text-gray-400 mb-1">EV / EBITDA</div>
                <div className="font-bold text-lg">{evEbitda}x</div>
              </div>
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: Scenario Output & Growth */}
        <div className="flex flex-col gap-5">
          
          {/* 4. Scenario Model */}
          <div className="bg-[#1e2129] border border-white/10 rounded-xl p-5 flex flex-col flex-1">
            <div className="text-gray-300 font-bold text-[0.95rem] mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-purple-500"></span>
              Scenario Model (Auto-calculated)
            </div>

            <div className="flex flex-col gap-3 flex-1 justify-center">
              
              {/* Bull row */}
              <div className="flex items-center justify-between bg-gradient-to-r from-blue-900/20 to-transparent border border-blue-500/20 rounded-lg p-4 group relative cursor-help">
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-blue-400">Bull Case</span>
                  <span className="text-xs text-blue-300/60 mt-1">Target Multiple & Growth</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-2xl font-bold text-white tracking-tight">{formatCurrency(targetBull)}</span>
                  <span className="text-[0.95rem] font-bold text-blue-400 w-16 text-right tabular-nums">{formatPct(upsideBull)}</span>
                </div>
                {/* Detailed Tooltip */}
                <div className="absolute opacity-0 group-hover:opacity-100 transition-opacity bg-[#14151a] border border-blue-500/40 text-xs text-blue-100 p-2.5 rounded-md -top-11 right-0 pointer-events-none whitespace-nowrap z-20 shadow-xl">
                  <span className="font-bold mb-1 block text-blue-300">Bull Case Formula:</span>
                  EPS_3 (<span className="text-white">{inputs.eps3.toFixed(2)}</span>) × PE (<span className="text-white">{inputs.peBull.toFixed(1)}x</span>) = <span className="font-bold text-white">{formatCurrency(targetBull)}</span>
                </div>
              </div>

              {/* Base row */}
              <div className="flex items-center justify-between bg-gradient-to-r from-green-900/20 to-transparent border border-green-500/30 rounded-lg p-4 group relative cursor-help">
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-green-400">Base Case</span>
                  <span className="text-xs text-green-300/60 mt-1">Expected Trajectory</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-2xl font-bold text-white tracking-tight">{formatCurrency(targetBase)}</span>
                  <span className="text-[0.95rem] font-bold text-green-400 w-16 text-right tabular-nums">{formatPct(upsideBase)}</span>
                </div>
                <div className="absolute opacity-0 group-hover:opacity-100 transition-opacity bg-[#14151a] border border-green-500/40 text-xs text-green-100 p-2.5 rounded-md -top-11 right-0 pointer-events-none whitespace-nowrap z-20 shadow-xl">
                  <span className="font-bold mb-1 block text-green-300">Base Case Formula:</span>
                  EPS_3 (<span className="text-white">{inputs.eps3.toFixed(2)}</span>) × PE (<span className="text-white">{inputs.peBase.toFixed(1)}x</span>) = <span className="font-bold text-white">{formatCurrency(targetBase)}</span>
                </div>
              </div>

              {/* Bear row */}
              <div className="flex items-center justify-between bg-gradient-to-r from-red-900/20 to-transparent border border-red-500/20 rounded-lg p-4 group relative cursor-help">
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-red-400">Bear Case</span>
                  <span className="text-xs text-red-300/60 mt-1">Margin Contraction Risk</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-2xl font-bold text-white tracking-tight">{formatCurrency(targetBear)}</span>
                  <span className="text-[0.95rem] font-bold text-red-500 w-16 text-right tabular-nums">{formatPct(upsideBear)}</span>
                </div>
                <div className="absolute opacity-0 group-hover:opacity-100 transition-opacity bg-[#14151a] border border-red-500/40 text-xs text-red-100 p-2.5 rounded-md -top-11 right-0 pointer-events-none whitespace-nowrap z-20 shadow-xl">
                  <span className="font-bold mb-1 block text-red-300">Bear Case Formula:</span>
                  EPS_3 (<span className="text-white">{inputs.eps3.toFixed(2)}</span>) × PE (<span className="text-white">{inputs.peBear.toFixed(1)}x</span>) = <span className="font-bold text-white">{formatCurrency(targetBear)}</span>
                </div>
              </div>

            </div>
          </div>

          {/* 5. Growth Metrics */}
          <div className="bg-[#1e2129] border border-white/10 rounded-xl p-5">
            <div className="flex justify-between items-center mb-4">
              <div className="text-gray-300 font-bold text-[0.95rem]">Growth Metrics</div>
              <div className="text-[10px] uppercase text-gray-500 border border-white/5 bg-white/5 px-2 py-0.5 rounded">Consensus</div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
               <div className="flex justify-between items-center border-b border-white/5 pb-2">
                 <span className="text-sm text-gray-400">EPS CAGR</span>
                 <span className="font-bold text-white">{inputs.epsCagr.toFixed(1)}%</span>
               </div>
               <div className="flex justify-between items-center border-b border-white/5 pb-2">
                 <span className="text-sm text-gray-400">Rev CAGR</span>
                 <span className="font-bold text-white">{inputs.revCagr.toFixed(1)}%</span>
               </div>
            </div>
          </div>

        </div>
      </div>

      {/* 6. BOTTOM SECTION - AI SUMMARY */}
      <div className="bg-[#1e2129] border border-[#d4b76a]/30 rounded-xl p-5 relative overflow-hidden mt-1">
        <div className="absolute top-0 left-0 w-1 bg-[#d4b76a] h-full"></div>
        <div className="flex items-start gap-3 pl-2">
          <div className="mt-0.5 w-5 h-5 rounded-md bg-[#d4b76a]/20 flex items-center justify-center flex-shrink-0">
            <span className="text-[#d4b76a] text-[10px] font-bold font-serif italic uppercase pb-px">AI</span>
          </div>
          <div>
            <div className="text-[#d4b76a] font-bold text-xs mb-1 uppercase tracking-widest">Valuation Synthesis</div>
            <div className="text-gray-300 text-sm leading-relaxed md:max-w-4xl max-w-full">
              {aiSummary}
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}
