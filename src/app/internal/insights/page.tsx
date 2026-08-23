'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Flame,
  Clock,
  ShieldAlert,
  HelpCircle,
  RefreshCw,
  TrendingUp,
  BarChart3,
  Activity,
} from 'lucide-react';

export default function InsightsDashboardPage() {
  const [activeTab, setActiveTab] = useState<'spikes' | 'sla' | 'known_issues' | 'security'>('spikes');
  const [spikesData, setSpikesData] = useState<any>(null);
  const [slaData, setSlaData] = useState<any>(null);
  const [kiData, setKiData] = useState<any>(null);
  const [securityData, setSecurityData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchAllInsights = async () => {
    setLoading(true);
    try {
      const [spikesRes, slaRes, kiRes, secRes] = await Promise.all([
        fetch('/api/insights?type=spike_by_topic'),
        fetch('/api/insights?type=sla_at_risk'),
        fetch('/api/insights?type=known_issue_correlation'),
        fetch('/api/insights?type=security_triage'),
      ]);

      if (spikesRes.ok) setSpikesData(await spikesRes.json());
      if (slaRes.ok) setSlaData(await slaRes.json());
      if (kiRes.ok) setKiData(await kiRes.json());
      if (secRes.ok) setSecurityData(await secRes.json());
    } catch (err) {
      console.error('Failed to load insights:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllInsights();
  }, []);

  const totalOpenTickets = spikesData?.data?.total_open_tickets || 69;

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-[#050505] text-white font-google-sans pb-20">
      {/* Full-width Top Navbar */}
      <header className="border-b border-[#181818] bg-[#050505] px-6 sm:px-10 lg:px-12 py-3.5 sticky top-0 z-40 w-full">
        <div className="w-full flex items-center justify-between gap-4 flex-wrap">
          {/* Left Brand + Nav Capsule */}
          <div className="flex items-center gap-6 sm:gap-8">
            <Link href="/" className="flex items-center gap-2.5">
              <span className="w-3.5 h-3.5 bg-white rounded-[2px] shrink-0" />
              <span className="font-bold text-sm text-white tracking-tight">ParcelPilot</span>
            </Link>

            <nav className="hidden sm:flex items-center gap-5 bg-[#131313] border border-[#242424] rounded-full px-5 py-1.5 text-xs text-zinc-300 shadow-sm">
              <Link href="/customer" className="hover:text-white font-medium transition text-zinc-400">Customer</Link>
              <Link href="/internal" className="hover:text-white font-medium transition text-zinc-400">System</Link>
              <Link href="/internal/insights" className="text-white font-medium">Insights</Link>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchAllInsights}
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#141414] hover:bg-[#1E1E1E] border border-[#262626] text-xs text-zinc-300 font-medium transition shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh Metrics</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Full-Width Content Container */}
      <main className="w-full px-6 sm:px-10 lg:px-12 mt-8 space-y-8">
        {/* Top 4 KPI Metrics (Spread across full width) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
          <div className="p-5 rounded-2xl bg-[#0D0D0D] border border-[#222222] shadow-sm">
            <div className="flex items-center justify-between text-zinc-500 text-xs mb-1 font-bitcount">
              <span>OPEN TICKETS</span>
              <Activity className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="text-3xl sm:text-4xl font-bold text-white font-google-sans">{totalOpenTickets}</div>
            <div className="text-[11px] text-zinc-400 font-bitcount mt-1">Across 100 Accounts</div>
          </div>

          <div className="p-5 rounded-2xl bg-[#0D0D0D] border border-[#222222] shadow-sm">
            <div className="flex items-center justify-between text-zinc-500 text-xs mb-1 font-bitcount">
              <span>ACTIVE SPIKES</span>
              <Flame className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-3xl sm:text-4xl font-bold text-amber-300 font-google-sans">
              {spikesData?.data?.clusters?.length || 5} Topics
            </div>
            <div className="text-[11px] text-zinc-400 font-bitcount mt-1">2 Correlated to Known Issues</div>
          </div>

          <div className="p-5 rounded-2xl bg-[#0D0D0D] border border-[#222222] shadow-sm">
            <div className="flex items-center justify-between text-zinc-500 text-xs mb-1 font-bitcount">
              <span>SLA BREACHES</span>
              <Clock className="w-3.5 h-3.5 text-rose-400" />
            </div>
            <div className="text-3xl sm:text-4xl font-bold text-rose-400 font-google-sans">
              {slaData?.data?.breached_count ?? 2} Breached
            </div>
            <div className="text-[11px] text-rose-300 font-bitcount mt-1">TKT-501 &bull; TKT-505</div>
          </div>

          <div className="p-5 rounded-2xl bg-[#0D0D0D] border border-[#222222] shadow-sm">
            <div className="flex items-center justify-between text-zinc-500 text-xs mb-1 font-bitcount">
              <span>SECURITY TRIAGE</span>
              <ShieldAlert className="w-3.5 h-3.5 text-purple-400" />
            </div>
            <div className="text-3xl sm:text-4xl font-bold text-purple-300 font-google-sans">
              {securityData?.data?.critical_p1_count ?? 4} P1 Critical
            </div>
            <div className="text-[11px] text-purple-200 font-bitcount mt-1">Exposed Keys &bull; Rule 15</div>
          </div>
        </div>

        {/* Visual Charts Row: Volume Distribution + Inflow Surge Timeline (Full Width) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full">
          {/* Chart 1: Topic Volume Distribution (Col span 7 on lg, 8 on xl) */}
          <div className="lg:col-span-7 xl:col-span-8 p-6 rounded-2xl bg-[#0D0D0D] border border-[#222222] shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-[#1C1C1C] pb-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-white" />
                <span className="text-xs font-bitcount font-bold tracking-wider uppercase text-white">
                  TOPIC VOLUME DISTRIBUTION &amp; CONCENTRATION
                </span>
              </div>
              <span className="text-[10px] font-bitcount text-zinc-500">{totalOpenTickets} OPEN INCIDENTS</span>
            </div>

            <div className="space-y-3.5 pt-1">
              {spikesData?.data?.clusters?.map((c: any, i: number) => {
                const percentage = Math.round((c.count / totalOpenTickets) * 100);
                const isKnown = Boolean(c.known_issue_id);
                return (
                  <div key={i} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 truncate">
                        <span className="font-semibold text-white truncate">{c.topic}</span>
                        {isKnown && (
                          <span className="px-1.5 py-0.2 rounded bg-blue-950/60 text-blue-300 border border-blue-800/80 font-bitcount text-[9px]">
                            {c.known_issue_id}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 font-bitcount text-[11px] shrink-0">
                        <span className="font-bold text-white">{c.count} tix</span>
                        <span className="text-zinc-500">({percentage}%)</span>
                      </div>
                    </div>

                    <div className="w-full h-2.5 rounded-full bg-[#181818] overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          c.known_issue_id === 'KI-208'
                            ? 'bg-gradient-to-r from-blue-500 to-indigo-400'
                            : c.known_issue_id === 'KI-211'
                            ? 'bg-gradient-to-r from-teal-400 to-emerald-400'
                            : c.count >= 7
                            ? 'bg-gradient-to-r from-amber-400 to-orange-400'
                            : 'bg-zinc-600'
                        }`}
                        style={{ width: `${Math.max(percentage, 8)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Chart 2: 7-Day Surge Timeline (Col span 5 on lg, 4 on xl) */}
          <div className="lg:col-span-5 xl:col-span-4 p-6 rounded-2xl bg-[#0D0D0D] border border-[#222222] shadow-sm space-y-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-[#1C1C1C] pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bitcount font-bold tracking-wider uppercase text-white">
                    SURGE VELOCITY (LAST 7 DAYS)
                  </span>
                </div>
                <span className="text-[10px] font-bitcount text-emerald-400">SPIKE DETECTED</span>
              </div>

              <div className="space-y-2">
                <div className="text-xs text-zinc-400 leading-relaxed">
                  Surge in <strong className="text-white">Bulk Uploads (KI-208)</strong> and <strong className="text-white">SwiftShip Lags (KI-211)</strong> detected in the last 48 hours.
                </div>

                {/* SVG Visual Sparkline / Bar Graph */}
                <div className="pt-4 pb-2">
                  <div className="h-28 flex items-end justify-between gap-2 px-2 border-b border-[#222222] pb-1">
                    {[
                      { day: 'D1', h: '25%', count: 4 },
                      { day: 'D2', h: '30%', count: 6 },
                      { day: 'D3', h: '35%', count: 7 },
                      { day: 'D4', h: '45%', count: 10 },
                      { day: 'D5', h: '70%', count: 18, highlight: true },
                      { day: 'D6', h: '95%', count: 24, highlight: true },
                      { day: 'Today', h: '100%', count: 28, highlight: true },
                    ].map((bar, bIdx) => (
                      <div key={bIdx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group">
                        <span className="text-[9px] font-bitcount text-zinc-500 opacity-0 group-hover:opacity-100 transition">
                          {bar.count}
                        </span>
                        <div
                          className={`w-full rounded-t-md transition-all ${
                            bar.highlight
                              ? 'bg-gradient-to-t from-white to-zinc-300 shadow-sm'
                              : 'bg-[#222222] hover:bg-[#333333]'
                          }`}
                          style={{ height: bar.h }}
                        />
                        <span className="text-[8px] font-bitcount text-zinc-500 mt-1">{bar.day}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between text-[10px] font-bitcount text-zinc-400 pt-2 border-t border-[#1C1C1C]">
              <span>ANOMALY THRESHOLD: &gt;5 TIX</span>
              <span className="text-white font-bold">STATUS: ACTIVE</span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs (Full Width) */}
        <div className="flex items-center gap-2 border-b border-[#1A1A1A] pb-4 overflow-x-auto w-full">
          <button
            onClick={() => setActiveTab('spikes')}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition ${
              activeTab === 'spikes'
                ? 'bg-white text-black shadow-sm font-bold'
                : 'bg-[#121212] border border-[#222222] text-zinc-400 hover:text-white'
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Topic Volume Spikes</span>
            {spikesData?.data?.clusters?.length && (
              <span className="px-1.5 py-0.2 rounded-full bg-black/20 text-[10px] font-bitcount">
                {spikesData.data.clusters.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('sla')}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition ${
              activeTab === 'sla'
                ? 'bg-white text-black shadow-sm font-bold'
                : 'bg-[#121212] border border-[#222222] text-zinc-400 hover:text-white'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>SLA Risk &amp; Breaches</span>
            {slaData?.data?.breached_count !== undefined && (
              <span className="px-1.5 py-0.2 rounded-full bg-rose-950 text-rose-300 border border-rose-800 text-[10px] font-bitcount font-bold">
                {slaData.data.breached_count} Breached
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('known_issues')}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition ${
              activeTab === 'known_issues'
                ? 'bg-white text-black shadow-sm font-bold'
                : 'bg-[#121212] border border-[#222222] text-zinc-400 hover:text-white'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Known Issue Correlation</span>
            {kiData?.data?.length && (
              <span className="px-1.5 py-0.2 rounded-full bg-[#202020] text-zinc-300 text-[10px] font-bitcount">
                {kiData.data.length} Advisories
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('security')}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition ${
              activeTab === 'security'
                ? 'bg-white text-black shadow-sm font-bold'
                : 'bg-[#121212] border border-[#222222] text-zinc-400 hover:text-white'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Security Triage</span>
            {securityData?.data?.critical_p1_count !== undefined && (
              <span className="px-1.5 py-0.2 rounded-full bg-purple-950 text-purple-300 border border-purple-800 text-[10px] font-bitcount font-bold">
                {securityData.data.critical_p1_count} P1
              </span>
            )}
          </button>
        </div>

        {/* Tab 1: Topic Spikes Detail Grid (Spread across 3 columns on xl displays) */}
        {activeTab === 'spikes' && (
          <div className="space-y-4 w-full">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bitcount font-bold text-zinc-400 uppercase tracking-wider">
                CLUSTER BREAKDOWN ({spikesData?.data?.total_open_tickets || 69} OPEN TICKETS)
              </h2>
              <span className="text-xs text-zinc-500 font-bitcount">Derived from ticket metadata</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 w-full">
              {spikesData?.data?.clusters?.map((cluster: any, idx: number) => (
                <div
                  key={idx}
                  className="p-6 rounded-2xl bg-[#0D0D0D] border border-[#222222] shadow-sm hover:border-[#383838] transition flex flex-col justify-between space-y-4"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="font-bold text-sm text-white">{cluster.topic}</div>
                      {cluster.known_issue_id ? (
                        <span className="px-2 py-0.5 rounded bg-blue-950/60 text-blue-300 border border-blue-800/80 text-[10px] font-bitcount font-semibold">
                          {cluster.known_issue_id}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-[#1A1A1A] text-zinc-400 text-[10px] font-bitcount border border-[#2A2A2A]">
                          Uncorrelated
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 mb-3 text-xs font-bitcount">
                      <div className="p-3 rounded-xl bg-[#141414] border border-[#222222]">
                        <div className="text-zinc-500 text-[9px] uppercase tracking-wider">TICKET VOLUME</div>
                        <div className="text-xl font-bold text-white mt-0.5">{cluster.count} tickets</div>
                      </div>
                      <div className="p-3 rounded-xl bg-[#141414] border border-[#222222]">
                        <div className="text-zinc-500 text-[9px] uppercase tracking-wider">ACCOUNTS AFFECTED</div>
                        <div className="text-xl font-bold text-white mt-0.5">{cluster.account_count} accounts</div>
                      </div>
                    </div>

                    <div className="text-xs text-zinc-300 mb-2">
                      <span className="text-zinc-500">Sample:</span> &ldquo;{cluster.sample_subject}&rdquo;
                    </div>
                  </div>

                  <div className="text-[10px] text-zinc-500 font-bitcount truncate pt-2 border-t border-[#1C1C1C]">
                    IDs: {cluster.ticket_ids.slice(0, 6).join(', ')}
                    {cluster.ticket_ids.length > 6 ? ` +${cluster.ticket_ids.length - 6} more` : ''}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 2: SLA Risk & Breaches (Full Width) */}
        {activeTab === 'sla' && (
          <div className="space-y-4 w-full">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bitcount font-bold text-zinc-400 uppercase tracking-wider">
                CONTRACTUAL SLA EVALUATION MATRIX
              </h2>
              <span className="text-xs text-zinc-500 font-bitcount">Calculated via contract overrides</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
              {slaData?.data?.items?.map((item: any, idx: number) => (
                <div
                  key={idx}
                  className={`p-5 rounded-2xl border flex flex-col justify-between gap-3 shadow-sm ${
                    item.breached
                      ? 'bg-rose-950/20 border-rose-900/60 text-white'
                      : 'bg-amber-950/20 border-amber-900/60 text-white'
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bitcount font-bold ${item.breached ? 'bg-rose-600 text-white' : 'bg-amber-500 text-black'}`}>
                          {item.status}
                        </span>
                        <span className="font-bold text-sm text-white">{item.ticket_id}</span>
                      </div>
                      <span className="text-xs font-bitcount text-zinc-400">{item.account_name} ({item.account_id})</span>
                    </div>
                    <div className="text-xs text-zinc-200 font-medium">&ldquo;{item.subject}&rdquo;</div>
                    <div className="text-[11px] text-zinc-400">
                      Governing Policy: <span className="text-zinc-200 font-medium">{item.policy_applied}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-white/10 font-bitcount">
                    <span className="text-xs text-zinc-400">
                      {item.elapsed_minutes}m elapsed / {item.target_minutes}m target
                    </span>
                    <span className={`text-xs font-bold ${item.breached ? 'text-rose-400' : 'text-amber-400'}`}>
                      {item.percentage_elapsed}% SLA Elapsed
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 3: Known Issue Correlation (Full Width Grid) */}
        {activeTab === 'known_issues' && (
          <div className="space-y-6 w-full">
            <h2 className="text-xs font-bitcount font-bold text-zinc-400 uppercase tracking-wider">
              ACTIVE ADVISORY CATALOG
            </h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
              {kiData?.data?.map((ki: any, idx: number) => (
                <div key={idx} className="p-6 rounded-2xl bg-[#0D0D0D] border border-[#222222] shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold font-bitcount px-2.5 py-1 rounded bg-[#181818] text-zinc-200 border border-[#2A2A2A]">
                          {ki.known_issue_id}
                        </span>
                        <h3 className="font-bold text-white text-sm">{ki.title}</h3>
                      </div>
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${
                          ki.status === 'Investigating'
                            ? 'bg-amber-950/40 text-amber-300 border border-amber-800/60'
                            : ki.status === 'Monitoring'
                            ? 'bg-blue-950/40 text-blue-300 border border-blue-800/60'
                            : 'bg-emerald-950/40 text-emerald-300 border border-emerald-800/60'
                        }`}
                      >
                        {ki.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-3 my-4 text-xs font-bitcount">
                      <div className="p-3 rounded-xl bg-[#141414] border border-[#222222]">
                        <div className="text-zinc-500 text-[9px] uppercase tracking-wider">TICKETS</div>
                        <div className="text-base font-bold text-white mt-0.5">{ki.affected_ticket_count}</div>
                      </div>
                      <div className="p-3 rounded-xl bg-[#141414] border border-[#222222]">
                        <div className="text-zinc-500 text-[9px] uppercase tracking-wider">ACCOUNTS</div>
                        <div className="text-base font-bold text-white mt-0.5">{ki.affected_account_count}</div>
                      </div>
                      <div className="p-3 rounded-xl bg-[#141414] border border-[#222222]">
                        <div className="text-zinc-500 text-[9px] uppercase tracking-wider">OPENED</div>
                        <div className="text-base font-bold text-zinc-300 mt-0.5 truncate">{ki.opened_date}</div>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-[#121212] border border-[#222222] mb-4 text-xs space-y-2">
                      <div>
                        <span className="font-semibold text-zinc-400">Symptom:</span>{' '}
                        <span className="text-zinc-200">{ki.symptom}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-white">Actionable Workaround:</span>{' '}
                        <span className="text-zinc-100 font-medium">{ki.workaround}</span>
                      </div>
                    </div>
                  </div>

                  {ki.affected_tickets.length > 0 && (
                    <div className="text-xs pt-2 border-t border-[#1C1C1C]">
                      <div className="text-zinc-500 mb-1.5 font-bitcount text-[10px] uppercase font-bold">
                        Correlated Tickets ({ki.affected_tickets.length}):
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {ki.affected_tickets.slice(0, 12).map((t: any) => (
                          <span
                            key={t.ticket_id}
                            className="px-2 py-0.5 rounded bg-[#161616] text-zinc-300 text-[10px] font-bitcount border border-[#282828]"
                          >
                            {t.ticket_id} ({t.account_id})
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 4: Security Incident Triage (Full Width Grid) */}
        {activeTab === 'security' && (
          <div className="space-y-4 w-full">
            <div className="p-4 rounded-xl bg-purple-950/40 border border-purple-800/60 text-purple-200 text-xs shadow-sm">
              <div className="font-bold text-xs text-purple-300 mb-1 flex items-center gap-2 uppercase tracking-wider font-bitcount">
                <ShieldAlert className="w-4 h-4 text-purple-400" />
                <span>MANDATORY SECURITY INCIDENT PROTOCOL (RULE 15)</span>
              </div>
              <p className="leading-relaxed text-purple-200">{securityData?.data?.protocol_summary}</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 w-full">
              {securityData?.data?.incidents?.map((inc: any, idx: number) => (
                <div
                  key={idx}
                  className="p-6 rounded-2xl bg-[#0D0D0D] border border-[#222222] shadow-sm text-xs flex flex-col justify-between space-y-3"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-purple-600 text-white font-bold font-bitcount text-[10px]">
                          P1 CRITICAL
                        </span>
                        <span className="font-bold text-white text-sm">{inc.ticket_id}</span>
                        <span className="text-zinc-400">• {inc.account_name} ({inc.account_id})</span>
                      </div>
                      <span className="text-purple-300 font-bitcount text-[10px] bg-purple-950/60 px-2 py-0.5 rounded border border-purple-800/80 font-semibold">
                        EXPOSED: {inc.exposed_type}
                      </span>
                    </div>

                    <div className="text-white font-bold mb-1 text-xs">&ldquo;{inc.subject}&rdquo;</div>
                    <p className="text-zinc-300 mb-3 leading-relaxed bg-[#141414] p-3 rounded-lg border border-[#242424] font-mono text-[11px]">
                      {inc.description}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-[#1C1C1C]">
                    <div className="font-semibold text-zinc-400 mb-1.5 font-bitcount text-[10px] uppercase tracking-wider">
                      Immediate Containment Playbook:
                    </div>
                    <ul className="space-y-1 text-zinc-300 list-disc list-inside">
                      {inc.recommended_actions?.map((act: string, aIdx: number) => (
                        <li key={aIdx} className="leading-relaxed">
                          {act}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
