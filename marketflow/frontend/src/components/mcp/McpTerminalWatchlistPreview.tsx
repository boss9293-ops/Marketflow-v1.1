'use client'

import { useEffect, useState } from 'react'
import {
  McpTerminalEventFeedContext,
  McpWatchlistNewsContext,
  sampleTerminalWatchlistMcpContext,
} from '@/lib/mcp/terminalWatchlistContract'
import {
  fetchTerminalEventFeedContext,
  fetchWatchlistNewsContext,
} from '@/lib/mcp/terminalWatchlistReader'

type PreviewState = {
  terminal: McpTerminalEventFeedContext
  watchlist: McpWatchlistNewsContext
  loading: boolean
}

const initialState: PreviewState = {
  terminal: sampleTerminalWatchlistMcpContext.terminal_event_feed_context,
  watchlist: sampleTerminalWatchlistMcpContext.watchlist_news_context,
  loading: true,
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`
}

function sourceLabel(source: string): string {
  return source === 'cache' ? 'cache' : 'fallback'
}

export default function McpTerminalWatchlistPreview() {
  const [state, setState] = useState<PreviewState>(initialState)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const [terminal, watchlist] = await Promise.all([
        fetchTerminalEventFeedContext(),
        fetchWatchlistNewsContext(),
      ])

      if (!cancelled) {
        setState({ terminal, watchlist, loading: false })
      }
    }

    load().catch(() => {
      if (!cancelled) {
        setState({
          terminal: sampleTerminalWatchlistMcpContext.terminal_event_feed_context,
          watchlist: sampleTerminalWatchlistMcpContext.watchlist_news_context,
          loading: false,
        })
      }
    })

    return () => {
      cancelled = true
    }
  }, [])

  const terminalRows = state.terminal.top_events
  const watchlistRows = state.watchlist.ranked_watchlist_news
  const hasFallback =
    state.terminal._meta.source !== 'cache' || state.watchlist._meta.source !== 'cache'

  return (
    <main className="min-h-screen bg-[#101318] px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <header className="border-b border-slate-800 pb-4">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
            Internal MCP Preview
          </div>
          <h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">
            Terminal & Watchlist Context
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Read-only view of backend MCP context. Existing production Terminal and Watchlist views remain unchanged.
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-400">
            <span className="rounded-md border border-slate-700 px-2 py-1">
              Terminal source: {sourceLabel(state.terminal._meta.source)}
            </span>
            <span className="rounded-md border border-slate-700 px-2 py-1">
              Watchlist source: {sourceLabel(state.watchlist._meta.source)}
            </span>
            <span className="rounded-md border border-slate-700 px-2 py-1">
              Live API attempted: false
            </span>
          </div>
        </header>

        {state.loading ? (
          <div className="rounded-lg border border-slate-800 bg-slate-950/40 px-4 py-3 text-sm text-slate-300">
            Loading MCP context...
          </div>
        ) : hasFallback ? (
          <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
            MCP context is not available yet.
          </div>
        ) : null}

        <section className="rounded-lg border border-slate-800 bg-slate-950/35">
          <div className="border-b border-slate-800 px-4 py-3">
            <h2 className="text-base font-semibold text-white">Terminal MCP Context</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-900/70 text-xs uppercase text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Rank</th>
                  <th className="px-4 py-3 font-medium">Symbol</th>
                  <th className="px-4 py-3 font-medium">Event Type</th>
                  <th className="px-4 py-3 font-medium">Strength</th>
                  <th className="px-4 py-3 font-medium">Price Confirmation</th>
                  <th className="px-4 py-3 font-medium">Why It Matters</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {terminalRows.length ? (
                  terminalRows.slice(0, 10).map((row) => (
                    <tr key={`${row.rank}-${row.symbol}-${row.headline}`} className="align-top">
                      <td className="px-4 py-3 font-mono text-xs text-slate-300">{row.rank}</td>
                      <td className="px-4 py-3 font-semibold text-cyan-200">{row.symbol}</td>
                      <td className="px-4 py-3 text-slate-300">{row.event_type}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-300">
                        {formatPercent(row.event_strength)}
                      </td>
                      <td className="px-4 py-3 text-slate-300">{row.price_confirmation}</td>
                      <td className="max-w-xl px-4 py-3 leading-6 text-slate-300">{row.why_it_matters}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-4 py-6 text-slate-400" colSpan={6}>
                      MCP context is not available yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-lg border border-slate-800 bg-slate-950/35">
          <div className="border-b border-slate-800 px-4 py-3">
            <h2 className="text-base font-semibold text-white">Watchlist MCP Context</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-900/70 text-xs uppercase text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Symbol</th>
                  <th className="px-4 py-3 font-medium">Attention Score</th>
                  <th className="px-4 py-3 font-medium">Risk Pressure</th>
                  <th className="px-4 py-3 font-medium">Signal Quality</th>
                  <th className="px-4 py-3 font-medium">Main Event</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {watchlistRows.length ? (
                  watchlistRows.slice(0, 12).map((row) => (
                    <tr key={`${row.symbol}-${row.main_event}`} className="align-top">
                      <td className="px-4 py-3 font-semibold text-cyan-200">{row.symbol}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-300">{row.attention_score}</td>
                      <td className="px-4 py-3 text-slate-300">{row.risk_pressure}</td>
                      <td className="px-4 py-3 text-slate-300">{row.signal_quality}</td>
                      <td className="max-w-xl px-4 py-3 leading-6 text-slate-300">{row.main_event}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-4 py-6 text-slate-400" colSpan={5}>
                      MCP context is not available yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  )
}

