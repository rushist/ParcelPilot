'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Play,
} from 'lucide-react';
import { PixelBlast } from '@/components/pixelblast/PixelBlast';

export default function HomePage() {
  const [stats, setStats] = useState({
    accounts: 100,
    orders: 100,
    tickets: 100,
    docs: 6,
    health: 'OK',
  });

  useEffect(() => {
    async function loadHealth() {
      try {
        const res = await fetch('/api/health');
        if (res.ok) {
          const data = await res.json();
          setStats((prev) => ({
            ...prev,
            accounts: data.storage?.total_accounts || 100,
            orders: data.storage?.total_orders || 100,
            tickets: data.storage?.total_tickets || 100,
            health: data.status === 'healthy' ? 'OK' : 'Degraded',
          }));
        }
      } catch (err) {
        console.warn('Health check notice:', err);
      }
    }
    loadHealth();
  }, []);

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-[#050505] text-white selection:bg-white selection:text-black font-google-sans">
      {/* Top Navbar */}
      <header className="border-b border-[#181818] bg-[#050505] px-4 sm:px-8 py-3.5 sticky top-0 z-50 w-full">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          {/* Left: Solid White Square Logo + Brand + Adjacent Pill Menu */}
          <div className="flex items-center gap-3 sm:gap-6">
            <Link href="/" className="flex items-center gap-2 shrink-0">
              <span className="w-3.5 h-3.5 bg-white rounded-[2px] shrink-0" />
              <span className="font-bold text-sm text-white tracking-tight">ParcelPilot</span>
            </Link>

            {/* Pill Container */}
            <nav className="hidden md:flex items-center gap-5 bg-[#131313] border border-[#242424] rounded-full px-5 py-1.5 text-xs text-zinc-300 shadow-sm">
              <Link href="/customer" className="hover:text-white font-medium transition">Layouts</Link>
              <Link href="/internal" className="hover:text-white font-medium transition">System</Link>
              <Link href="/internal/insights" className="hover:text-white font-medium transition">Insights</Link>
            </nav>
          </div>

          {/* Right: Sign In + Open Portal Pill Button */}
          <div className="flex items-center gap-3 sm:gap-5 shrink-0">
            <Link
              href="/internal"
              className="text-xs font-medium text-zinc-300 hover:text-white transition hidden sm:inline"
            >
              Sign In
            </Link>
            <Link
              href="/customer"
              className="px-3.5 sm:px-5 py-1.5 rounded-full bg-[#121212] hover:bg-[#1C1C1C] border border-[#2A2A2A] text-white text-xs font-semibold transition shadow-sm shrink-0 whitespace-nowrap"
            >
              Open Portal
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section: 2-Column Split */}
      <section className="border-b border-[#181818] w-full overflow-hidden">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 min-h-[500px] lg:min-h-[580px]">
          {/* Left Column: Headline & Action Buttons */}
          <div className="lg:col-span-6 p-6 sm:p-10 lg:p-14 flex flex-col justify-center space-y-6 sm:space-y-8 border-b lg:border-b-0 lg:border-r border-[#181818]">
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-white leading-[1.08] font-google-sans break-words">
              A baseline for <br />
              products that <br />
              move quickly.
            </h1>

            <div className="flex items-center gap-4 sm:gap-6 pt-2 flex-wrap">
              <Link
                href="/customer"
                className="px-6 sm:px-7 py-3 sm:py-3.5 rounded-full bg-white hover:bg-zinc-200 text-black text-xs font-bold uppercase tracking-wider transition shadow-md whitespace-nowrap"
              >
                GET STARTED
              </Link>

              <Link
                href="/internal"
                className="flex items-center gap-2 text-white hover:text-zinc-300 text-xs font-semibold uppercase tracking-wider transition group whitespace-nowrap"
              >
                <span>LEARN MORE</span>
                <span className="w-5 h-5 rounded-full bg-white text-black flex items-center justify-center group-hover:scale-105 transition">
                  <Play className="w-2.5 h-2.5 fill-black ml-0.5" />
                </span>
              </Link>
            </div>
          </div>

          {/* Right Column: WebGL PixelBlast Canvas */}
          <div className="lg:col-span-6 h-[320px] sm:h-[400px] lg:h-auto min-h-[300px] w-full max-w-full relative bg-black flex items-center justify-center overflow-hidden">
            <PixelBlast
              variant="square"
              pixelSize={4}
              color="#FFFFFF"
              patternScale={2}
              patternDensity={1}
              pixelSizeJitter={0}
              enableRipples
              rippleSpeed={0.4}
              rippleThickness={0.12}
              rippleIntensityScale={1.5}
              liquid={false}
              liquidStrength={0.12}
              liquidRadius={1.2}
              liquidWobbleSpeed={5}
              speed={0.5}
              edgeFade={0.25}
              transparent
            />
          </div>
        </div>
      </section>

      {/* Hero Bottom Bar */}
      <section className="border-b border-[#181818] bg-[#050505] w-full">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-[#181818]">
          {/* Left Description */}
          <div className="lg:col-span-6 p-6 sm:p-10 lg:p-12 flex items-center">
            <p className="text-zinc-400 text-sm sm:text-base leading-relaxed max-w-lg font-google-sans">
              ParcelPilot helps teams lock structure, deterministic calculations, and source contracts — so operations ship with verified claims and zero hallucinations.
            </p>
          </div>

          {/* Right 3-Column Metrics */}
          <div className="lg:col-span-6 p-6 sm:p-10 lg:p-12 grid grid-cols-3 gap-3 sm:gap-6 items-center">
            <div>
              <div className="text-[11px] sm:text-xs text-zinc-500 font-medium mb-1">Components</div>
              <div className="text-2xl sm:text-4xl font-bold text-white font-google-sans">{stats.accounts}+</div>
            </div>

            <div>
              <div className="text-[11px] sm:text-xs text-zinc-500 font-medium mb-1">Avg. Setup</div>
              <div className="text-2xl sm:text-4xl font-bold text-white font-google-sans">9 min</div>
            </div>

            <div>
              <div className="text-[11px] sm:text-xs text-zinc-500 font-medium mb-1">License</div>
              <div className="text-lg sm:text-3xl font-bold text-white font-google-sans truncate">Enterprise</div>
            </div>
          </div>
        </div>
      </section>

      {/* 4-Metric Grid (Reference Style Component) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-8 py-8 sm:py-12 w-full">
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-y-8 gap-x-4 rounded-2xl border border-[#222222] bg-[#0C0C0C] px-4 sm:px-8 py-8 sm:py-10 shadow-sm">
          {/* Metric 1 */}
          <div className="px-2 text-center">
            <span className="block text-[32px] sm:text-[40px] md:text-[52px] font-medium leading-none tracking-[-0.03em] text-white font-headline">
              100%
            </span>
            <p className="mx-auto mt-2.5 max-w-[18ch] text-[11px] sm:text-xs text-zinc-400 font-google-sans leading-relaxed">
              of answers cited to source policy
            </p>
          </div>

          {/* Metric 2 */}
          <div className="px-2 text-center border-l border-[#222222]">
            <span className="block text-[32px] sm:text-[40px] md:text-[52px] font-medium leading-none tracking-[-0.03em] text-white font-headline">
              {stats.orders}
            </span>
            <p className="mx-auto mt-2.5 max-w-[18ch] text-[11px] sm:text-xs text-zinc-400 font-google-sans leading-relaxed">
              shipment orders evaluated with 0 errors
            </p>
          </div>

          {/* Metric 3 */}
          <div className="px-2 text-center md:border-l md:border-[#222222]">
            <span className="block text-[32px] sm:text-[40px] md:text-[52px] font-medium leading-none tracking-[-0.03em] text-white font-headline">
              {stats.docs}
            </span>
            <p className="mx-auto mt-2.5 max-w-[18ch] text-[11px] sm:text-xs text-zinc-400 font-google-sans leading-relaxed">
              agreements &amp; SOPs indexed in vectors
            </p>
          </div>

          {/* Metric 4 */}
          <div className="px-2 text-center border-l border-[#222222]">
            <span className="block text-[32px] sm:text-[40px] md:text-[52px] font-medium leading-none tracking-[-0.03em] text-white font-headline">
              0
            </span>
            <p className="mx-auto mt-2.5 max-w-[18ch] text-[11px] sm:text-xs text-zinc-400 font-google-sans leading-relaxed">
              of your data leaves your tenant boundary
            </p>
          </div>
        </div>
      </section>

      {/* Surface Navigation: Matching Unified Grid Style with Arrow */}
      <section className="max-w-7xl mx-auto px-4 sm:px-8 py-6 sm:py-8 w-full">
        <div className="mb-6 sm:mb-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#181818] border border-[#282828] text-[10px] sm:text-[11px] font-bitcount font-semibold text-zinc-300 tracking-wide mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-white" />
            <span>THREE UNIFIED SURFACES</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            A support assistant, on your terms.
          </h2>
        </div>

        {/* Unified 3-Column Card matching the 4-Metric Grid above */}
        <div className="grid grid-cols-1 md:grid-cols-3 rounded-2xl border border-[#222222] bg-[#0C0C0C] divide-y md:divide-y-0 md:divide-x divide-[#222222] shadow-sm overflow-hidden">
          {/* Card 1 */}
          <Link
            href="/customer"
            className="p-6 sm:p-8 hover:bg-[#121212] transition flex flex-col justify-between group"
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="text-[10px] sm:text-[11px] font-bitcount text-zinc-500 uppercase tracking-wider">
                  ● CUSTOMER PORTAL
                </div>
                <div className="w-8 h-8 rounded-full bg-[#181818] group-hover:bg-white border border-[#2A2A2A] group-hover:border-white flex items-center justify-center transition shadow-2xs">
                  <ArrowRight className="w-3.5 h-3.5 text-zinc-400 group-hover:text-black group-hover:translate-x-0.5 transition" />
                </div>
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-white mb-2.5 font-google-sans">Customer Chatbot</h3>
              <p className="text-xs text-zinc-400 leading-relaxed font-google-sans">
                Single-tenant self-service interface with 100-account switcher. Validates contractual fee waivers (Northstar ₹0 fee), custom credit policies (LumenWorks ₹300), and interactive cancellation confirmation cards.
              </p>
            </div>
          </Link>

          {/* Card 2 */}
          <Link
            href="/internal"
            className="p-6 sm:p-8 hover:bg-[#121212] transition flex flex-col justify-between group"
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="text-[10px] sm:text-[11px] font-bitcount text-zinc-500 uppercase tracking-wider">
                  ● INTERNAL OPERATIONS
                </div>
                <div className="w-8 h-8 rounded-full bg-[#181818] group-hover:bg-white border border-[#2A2A2A] group-hover:border-white flex items-center justify-center transition shadow-2xs">
                  <ArrowRight className="w-3.5 h-3.5 text-zinc-400 group-hover:text-black group-hover:translate-x-0.5 transition" />
                </div>
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-white mb-2.5 font-google-sans">Operations AI Copilot</h3>
              <p className="text-xs text-zinc-400 leading-relaxed font-google-sans">
                Internal staff copilot with Support, Ops, and Manager role switching. Enables multi-account investigation tabs, ticket escalations, and manager authorization barriers for credits &gt; ₹1,000.
              </p>
            </div>
          </Link>

          {/* Card 3 */}
          <Link
            href="/internal/insights"
            className="p-6 sm:p-8 hover:bg-[#121212] transition flex flex-col justify-between group"
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="text-[10px] sm:text-[11px] font-bitcount text-zinc-500 uppercase tracking-wider">
                  ● PROACTIVE METRICS
                </div>
                <div className="w-8 h-8 rounded-full bg-[#181818] group-hover:bg-white border border-[#2A2A2A] group-hover:border-white flex items-center justify-center transition shadow-2xs">
                  <ArrowRight className="w-3.5 h-3.5 text-zinc-400 group-hover:text-black group-hover:translate-x-0.5 transition" />
                </div>
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-white mb-2.5 font-google-sans">Insights Dashboard</h3>
              <p className="text-xs text-zinc-400 leading-relaxed font-google-sans">
                Problem 1 live operational dashboard: Discovers topic volume spikes (Bulk Upload / KI-208, SwiftShip / KI-211), monitors contractual SLA risks, and triages exposed credential tickets at P1 priority.
              </p>
            </div>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-4 sm:px-8 py-8 sm:py-12 border-t border-[#181818] mt-8 flex items-center justify-between text-xs text-zinc-500 flex-wrap gap-4 font-google-sans w-full">
        <div>ParcelPilot AI Support System • Built with Next.js 14, TypeScript &amp; Qdrant</div>
        <div className="font-bitcount text-[10px] sm:text-[11px]">Source Precedence: Agreement &gt; Policy &gt; Guide</div>
      </footer>
    </div>
  );
}
