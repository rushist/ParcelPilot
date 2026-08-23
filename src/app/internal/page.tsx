'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Activity,
  UserCheck,
  Plus,
  X,
  Building2,
  ChevronDown,
  Search,
  Flame,
  Clock,
  ShieldAlert,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { ChatInterface, MessageItem } from '@/components/chat/ChatInterface';
import { InternalSession, InternalRole } from '@/types';
import { AccountRecord } from '@/db/schema';

interface ChatTab {
  id: string;
  title: string;
  accountId?: string;
  messages: MessageItem[];
}

export default function InternalChatPage() {
  const [role, setRole] = useState<InternalRole>('support');
  const [userName, setUserName] = useState('Agent_Maya');
  const [accounts, setAccounts] = useState<AccountRecord[]>([]);
  const [showAccountDropdown, setShowAccountDropdown] = useState(false);
  const [accountSearch, setAccountSearch] = useState('');
  const [proactiveAlerts, setProactiveAlerts] = useState<{
    spikeSummary?: string;
    slaBreachedCount?: number;
    securityP1Count?: number;
  }>({
    spikeSummary: 'Bulk CSV Upload Failures (18 tickets • KI-208)',
    slaBreachedCount: 2,
    securityP1Count: 4,
  });
  const [showProactiveBanner, setShowProactiveBanner] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Multi-tab state
  const [tabs, setTabs] = useState<ChatTab[]>([
    {
      id: 'tab-global',
      title: 'Global Investigation',
      messages: [],
    },
    {
      id: 'tab-acct-001',
      title: 'ACCT-001 • Northstar',
      accountId: 'ACCT-001',
      messages: [],
    },
  ]);
  const [activeTabId, setActiveTabId] = useState<string>('tab-global');

  useEffect(() => {
    async function loadData() {
      try {
        const [accRes, slaRes, secRes] = await Promise.all([
          fetch('/api/accounts'),
          fetch('/api/insights?type=sla_at_risk'),
          fetch('/api/insights?type=security_triage'),
        ]);

        if (accRes.ok) setAccounts(await accRes.json());
        if (slaRes.ok) {
          const sla = await slaRes.json();
          setProactiveAlerts((prev) => ({ ...prev, slaBreachedCount: sla.data?.breached_count || 2 }));
        }
        if (secRes.ok) {
          const sec = await secRes.json();
          setProactiveAlerts((prev) => ({ ...prev, securityP1Count: sec.data?.critical_p1_count || 4 }));
        }
      } catch (err) {
        console.error('Failed to load accounts/insights:', err);
      }
    }
    loadData();
  }, []);

  // Click outside listener to close account dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowAccountDropdown(false);
      }
    }
    if (showAccountDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showAccountDropdown]);

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];

  const session: InternalSession = {
    surface: 'internal',
    role,
    user_name: userName,
  };

  const suggestedPrompts = activeTab.accountId
    ? [
        `Check status and fee calculation for recent orders on ${activeTab.accountId}.`,
        `Are there open tickets or SLA risks for ${activeTab.accountId}?`,
        `Evaluate service credit eligibility for orders on ${activeTab.accountId}.`,
        `What governing contract or tier terms apply to ${activeTab.accountId}?`,
      ]
    : [
        'What are the active topic spikes across all open tickets?',
        'Show me all tickets currently breaching or at risk of SLA breach.',
        'How many customers are affected by known issue KI-208 (bulk upload failures)?',
        'Triage all security and exposed credential incidents across the platform.',
        'Check SLA status and governing contract for ticket TKT-501 (Northstar).',
        'Evaluate service credit eligibility for order ORD-2002 (LumenWorks).',
        'Propose an escalation for ticket TKT-505 (Axis Labs API key exposure).',
      ];

  const handleCreateNewTab = (account?: AccountRecord) => {
    const tabId = account ? `tab-${account.account_id}` : `tab-${Date.now()}`;
    const existing = tabs.find((t) => t.id === tabId);
    if (existing) {
      setActiveTabId(tabId);
      setShowAccountDropdown(false);
      return;
    }

    const newTab: ChatTab = {
      id: tabId,
      title: account ? `${account.account_id} • ${account.account_name.split(' ')[0]}` : `Investigation #${tabs.length + 1}`,
      accountId: account ? account.account_id : undefined,
      messages: [],
    };

    setTabs([...tabs, newTab]);
    setActiveTabId(tabId);
    setShowAccountDropdown(false);
    setAccountSearch('');
  };

  const handleCloseTab = (e: React.MouseEvent, tabIdToClose: string) => {
    e.stopPropagation();
    if (tabs.length <= 1) return;

    const newTabs = tabs.filter((t) => t.id !== tabIdToClose);
    setTabs(newTabs);

    if (activeTabId === tabIdToClose) {
      setActiveTabId(newTabs[0].id);
    }
  };

  const filteredAccounts = accounts.filter(
    (acc) =>
      acc.account_name.toLowerCase().includes(accountSearch.toLowerCase()) ||
      acc.account_id.toLowerCase().includes(accountSearch.toLowerCase()) ||
      acc.plan.toLowerCase().includes(accountSearch.toLowerCase())
  );

  return (
    <div className="h-screen max-h-screen flex flex-col bg-[#050505] text-white font-google-sans w-full max-w-full overflow-hidden">
      {/* Top Navbar (Full Width) */}
      <header className="border-b border-[#181818] bg-[#050505] px-4 sm:px-6 lg:px-8 py-3 sticky top-0 z-40 shrink-0 w-full">
        <div className="w-full flex items-center justify-between gap-4 flex-wrap">
          {/* Left Brand + Nav Capsule */}
          <div className="flex items-center gap-6 sm:gap-8">
            <Link href="/" className="flex items-center gap-2.5">
              <span className="w-3.5 h-3.5 bg-white rounded-[2px] shrink-0" />
              <span className="font-bold text-sm text-white tracking-tight">ParcelPilot</span>
            </Link>

            <nav className="hidden sm:flex items-center gap-5 bg-[#131313] border border-[#242424] rounded-full px-5 py-1.5 text-xs text-zinc-300 shadow-sm">
              <Link href="/customer" className="hover:text-white font-medium transition text-zinc-400">Customer</Link>
              <Link href="/internal" className="text-white font-medium">System</Link>
              <Link href="/internal/insights" className="hover:text-white font-medium transition text-zinc-400">Insights</Link>
            </nav>
          </div>

          {/* Role & Staff Switcher */}
          <div className="flex items-center gap-3">
            <Link
              href="/internal/insights"
              className="hidden sm:flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-[#141414] border border-[#242424] text-zinc-300 hover:bg-white hover:text-black transition font-medium"
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Insights Dashboard</span>
            </Link>

            <div className="flex items-center gap-1 bg-[#141414] border border-[#262626] rounded-full p-1">
              <span className="text-[11px] text-zinc-400 pl-2 pr-1 font-bitcount">ROLE:</span>
              {(['support', 'ops', 'manager'] as InternalRole[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setRole(r)}
                  className={`text-xs px-3 py-1 rounded-full font-medium capitalize transition ${
                    role === r
                      ? 'bg-white text-black font-semibold shadow-xs'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Proactive Intelligence Banner (Full Width) */}
      {showProactiveBanner && (
        <div className="w-full bg-[#0E0E0E] border-b border-[#242424] px-4 sm:px-6 lg:px-8 py-2.5 shrink-0 animate-in fade-in duration-200">
          <div className="w-full flex items-center justify-between gap-4 flex-wrap text-xs">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-950/50 border border-amber-800/70 text-amber-300 text-[10px] font-bitcount font-bold tracking-wide">
                <Sparkles className="w-3 h-3 text-amber-400 animate-pulse" />
                <span>PROACTIVE RADAR</span>
              </div>

              <div className="flex items-center gap-3 text-zinc-300 text-xs flex-wrap">
                <span className="flex items-center gap-1 text-rose-300 font-medium">
                  <Clock className="w-3.5 h-3.5 text-rose-400" />
                  <span><strong>{proactiveAlerts.slaBreachedCount} SLA Breaches</strong> (TKT-501, TKT-505)</span>
                </span>
                <span className="text-zinc-600 hidden sm:inline">&bull;</span>
                <span className="flex items-center gap-1 text-amber-300 font-medium">
                  <Flame className="w-3.5 h-3.5 text-amber-400" />
                  <span>{proactiveAlerts.spikeSummary}</span>
                </span>
                <span className="text-zinc-600 hidden sm:inline">&bull;</span>
                <span className="flex items-center gap-1 text-purple-300 font-medium">
                  <ShieldAlert className="w-3.5 h-3.5 text-purple-400" />
                  <span><strong>{proactiveAlerts.securityP1Count} P1 Leaks</strong></span>
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/internal/insights"
                className="flex items-center gap-1 text-[11px] text-white hover:text-zinc-300 font-bitcount font-bold uppercase transition"
              >
                <span>Triage in Dashboard</span>
                <ArrowRight className="w-3 h-3" />
              </Link>

              <button
                onClick={() => setShowProactiveBanner(false)}
                className="p-1 rounded text-zinc-500 hover:text-white"
                title="Dismiss banner"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Internal Multi-Tab Workspace Bar (Full Width) */}
      <div className="w-full border-b border-[#181818] bg-[#0A0A0A] px-4 sm:px-6 lg:px-8 py-2 shrink-0 relative z-30 overflow-visible">
        <div className="w-full flex items-center justify-between gap-3 relative overflow-visible">
          {/* Scrollable Tabs Row */}
          <div className="flex items-center gap-1.5 overflow-x-auto py-1 flex-1 min-w-0 pr-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTabId(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-medium transition border shrink-0 ${
                  activeTabId === tab.id
                    ? 'bg-white text-black border-white shadow-xs font-semibold'
                    : 'bg-[#141414] border-[#262626] text-zinc-400 hover:bg-[#1C1C1C] hover:text-white'
                }`}
              >
                {tab.accountId && (
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      activeTabId === tab.id ? 'bg-black' : 'bg-white'
                    }`}
                  />
                )}
                <span className="whitespace-nowrap">{tab.title}</span>

                {tabs.length > 1 && (
                  <span
                    onClick={(e) => handleCloseTab(e, tab.id)}
                    className={`p-0.5 rounded hover:bg-black/20 ml-1 transition ${
                      activeTabId === tab.id ? 'text-zinc-600 hover:text-black' : 'text-zinc-500 hover:text-white'
                    }`}
                    title="Close tab"
                  >
                    <X className="w-3 h-3" />
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Dedicated Actions & Dropdown Anchor */}
          <div className="flex items-center gap-2 shrink-0 relative" ref={dropdownRef}>
            <button
              onClick={() => handleCreateNewTab()}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#141414] border border-[#262626] hover:bg-[#1E1E1E] text-zinc-300 text-xs font-medium transition shadow-2xs"
              title="Open empty tab"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">New Tab</span>
            </button>

            <button
              onClick={() => setShowAccountDropdown(!showAccountDropdown)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition shadow-2xs ${
                showAccountDropdown
                  ? 'bg-white text-black border-white font-semibold'
                  : 'bg-[#181818] hover:bg-[#222222] border-[#2C2C2C] text-zinc-200'
              }`}
              title="Open account picker"
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>+ Account</span>
              <ChevronDown className="w-3 h-3" />
            </button>

            {/* Floating Account Dropdown */}
            {showAccountDropdown && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-[#121212] border border-[#282828] rounded-2xl p-3.5 shadow-[0_15px_50px_rgba(0,0,0,0.8)] z-50 animate-in fade-in slide-in-from-top-2 duration-150 text-white">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#222222]">
                  <span className="text-[10px] font-bitcount font-bold text-zinc-400 uppercase tracking-wider">
                    SELECT FROM {accounts.length} ACCOUNTS
                  </span>
                  <button
                    onClick={() => setShowAccountDropdown(false)}
                    className="p-1 rounded text-zinc-400 hover:text-white hover:bg-[#1E1E1E]"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="relative mb-2">
                  <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={accountSearch}
                    onChange={(e) => setAccountSearch(e.target.value)}
                    placeholder="Search company name, ID, plan..."
                    className="w-full pl-8 pr-3 py-1.5 bg-[#181818] border border-[#2E2E2E] focus:border-white rounded-lg text-xs text-white placeholder-zinc-500 focus:outline-none"
                    autoFocus
                  />
                </div>

                <div className="max-h-72 overflow-y-auto space-y-1 pr-1">
                  {filteredAccounts.length === 0 ? (
                    <div className="text-[11px] text-zinc-500 text-center py-6">
                      No accounts matching &ldquo;{accountSearch}&rdquo;
                    </div>
                  ) : (
                    filteredAccounts.map((acc) => (
                      <button
                        key={acc.account_id}
                        onClick={() => handleCreateNewTab(acc)}
                        className="w-full text-left px-3 py-2 rounded-xl hover:bg-[#1C1C1C] border border-transparent hover:border-[#2A2A2A] text-xs text-zinc-200 transition flex items-center justify-between group"
                      >
                        <div className="truncate mr-2">
                          <div className="font-semibold text-white truncate">{acc.account_name}</div>
                          <div className="text-[10px] text-zinc-500">Plan: {acc.plan} {acc.contract_file ? '• Custom Contract' : ''}</div>
                        </div>
                        <span className="text-[10px] font-bitcount text-zinc-400 group-hover:text-white font-bold shrink-0 bg-[#1F1F1F] px-1.5 py-0.5 rounded border border-[#303030]">
                          {acc.account_id}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Full-width Main Chat Interface */}
      <main className="flex-1 min-h-0 flex flex-col w-full overflow-hidden">
        <ChatInterface
          session={session}
          title={activeTab.title}
          subtitle={`Role: ${role.toUpperCase()} • ${activeTab.accountId ? `Focused on ${activeTab.accountId}` : 'Cross-account investigation & proactive triage'}`}
          accountId={activeTab.accountId}
          suggestedPrompts={suggestedPrompts}
        />
      </main>
    </div>
  );
}
