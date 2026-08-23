'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { ChatInterface } from '@/components/chat/ChatInterface';
import { CustomerSession } from '@/types';
import { AccountRecord } from '@/db/schema';

export default function CustomerChatPage() {
  const [accounts, setAccounts] = useState<AccountRecord[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('ACCT-001');
  const [loadingAccounts, setLoadingAccounts] = useState(true);

  useEffect(() => {
    async function loadAccounts() {
      try {
        const res = await fetch('/api/accounts');
        if (res.ok) {
          const data = await res.json();
          setAccounts(data);
        }
      } catch (err) {
        console.error('Failed to load accounts from database:', err);
      } finally {
        setLoadingAccounts(false);
      }
    }
    loadAccounts();
  }, []);

  const activeAccount = accounts.find((a) => a.account_id === selectedAccountId) || accounts[0] || {
    account_id: 'ACCT-001',
    account_name: 'Northstar Logistics',
    plan: 'Enterprise',
    status: 'active',
    contract_file: '05_Northstar_Logistics_Enterprise_Agreement.pdf',
    premium_support: true,
  };

  const session: CustomerSession = {
    surface: 'customer',
    account_id: activeAccount.account_id,
  };

  const suggestedPrompts = [
    `Can I cancel order ${activeAccount.account_id === 'ACCT-001' ? 'ORD-1001' : 'my shipment'}? What is the cancellation fee?`,
    'What is our contractual SLA response time for P1 critical incidents?',
    'What is the maximum supported CSV limit for bulk shipment uploads?',
    'My shipment was picked up by SwiftShip but still shows BOOKED. Why?',
    `Please cancel order ${activeAccount.account_id === 'ACCT-001' ? 'ORD-1001' : 'ORD-2001'} for me.`,
  ];

  return (
    <div className="h-screen max-h-screen flex flex-col bg-[#050505] text-white font-google-sans w-full max-w-full overflow-hidden">
      {/* Top Navbar (Full Width) */}
      <header className="border-b border-[#181818] bg-[#050505] px-4 sm:px-6 lg:px-8 py-3.5 sticky top-0 z-40 shrink-0 w-full">
        <div className="w-full flex items-center justify-between gap-4 flex-wrap">
          {/* Left Brand + Nav Capsule */}
          <div className="flex items-center gap-6 sm:gap-8">
            <Link href="/" className="flex items-center gap-2.5">
              <span className="w-3.5 h-3.5 bg-white rounded-[2px] shrink-0" />
              <span className="font-bold text-sm text-white tracking-tight">ParcelPilot</span>
            </Link>

            <nav className="hidden sm:flex items-center gap-5 bg-[#131313] border border-[#242424] rounded-full px-5 py-1.5 text-xs text-zinc-300 shadow-sm">
              <Link href="/customer" className="text-white font-medium">Customer</Link>
              <Link href="/internal" className="hover:text-white font-medium transition text-zinc-400">System</Link>
              <Link href="/internal/insights" className="hover:text-white font-medium transition text-zinc-400">Insights</Link>
            </nav>
          </div>

          {/* Right Account Switcher */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-zinc-400 hidden sm:inline font-bitcount">
              TENANT:
            </span>
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              disabled={loadingAccounts}
              className="bg-[#141414] border border-[#2A2A2A] text-xs text-white rounded-full px-3.5 py-1.5 focus:outline-none focus:border-white font-medium shadow-sm max-w-[280px]"
            >
              {accounts.map((acc) => (
                <option key={acc.account_id} value={acc.account_id} className="bg-[#141414] text-white">
                  {acc.account_id} — {acc.account_name} ({acc.plan})
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {/* Account Info Bar (Full Width) */}
      <div className="w-full border-b border-[#181818] bg-[#0A0A0A] px-4 sm:px-6 lg:px-8 py-2 shrink-0">
        <div className="w-full flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
            <div className="flex items-center gap-2 text-xs">
              <span className="font-bold text-white">{activeAccount.account_name}</span>
              <span className="text-[10px] px-2 py-0.2 rounded bg-[#181818] text-zinc-300 font-bitcount border border-[#2E2E2E]">
                {activeAccount.account_id}
              </span>
              <span className="text-[10px] px-2 py-0.2 rounded bg-[#181818] text-zinc-400 font-medium">
                {activeAccount.plan} Plan
              </span>
              {activeAccount.contract_file && (
                <span className="text-amber-300 font-medium font-bitcount text-[10px] hidden sm:inline">
                  • CUSTOM AGREEMENT ACTIVE
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-[10px] font-bitcount text-emerald-400 bg-emerald-950/40 border border-emerald-800/60 px-2.5 py-0.5 rounded-full font-semibold">
            <ShieldCheck className="w-3 h-3 text-emerald-400" />
            <span>SERVER-ISOLATED TENANT</span>
          </div>
        </div>
      </div>

      {/* Full-width Main Chat Interface */}
      <main className="flex-1 min-h-0 flex flex-col w-full overflow-hidden">
        <ChatInterface
          session={session}
          title={`${activeAccount.account_name} Assistant`}
          subtitle={`Account-scoped support engine for ${activeAccount.account_id}`}
          accountId={activeAccount.account_id}
          suggestedPrompts={suggestedPrompts}
        />
      </main>
    </div>
  );
}
