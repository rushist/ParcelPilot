'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { ChatInterface } from '@/components/chat/ChatInterface';
import { CustomerSession } from '@/types';
import { AccountRecord, TicketRecord } from '@/db/schema';
import { MaterialIcon } from '@/components/ui/MaterialIcon';

export default function CustomerChatPage() {
  const [accounts, setAccounts] = useState<AccountRecord[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('ACCT-001');
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [tickets, setTickets] = useState<TicketRecord[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);

  // Ticket creation modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [creatingTicket, setCreatingTicket] = useState(false);

  // Priority is deterministically triaged by the AI rather than customer self-assessment
  const evaluatedPriority = useMemo(() => {
    const combined = `${newSubject} ${newDescription}`.toLowerCase();
    if (
      combined.includes('outage') ||
      combined.includes('500') ||
      combined.includes('system down') ||
      combined.includes('cannot create') ||
      combined.includes('all creation failing') ||
      combined.includes('bulk failure') ||
      combined.includes('validation failure') ||
      combined.includes('security') ||
      combined.includes('token leak') ||
      combined.includes('emergency') ||
      combined.includes('critical') ||
      combined.includes('production down')
    ) {
      return { level: 'P1', label: 'P1 - Critical Outage', color: 'rose', icon: 'emergency', badgeBg: 'bg-rose-950/60 border-rose-800/80 text-rose-300' };
    }
    if (
      combined.includes('delay') ||
      combined.includes('late') ||
      combined.includes('missed') ||
      combined.includes('stuck') ||
      combined.includes('swiftship') ||
      combined.includes('pickup') ||
      combined.includes('webhook') ||
      combined.includes('timeout') ||
      combined.includes('breach') ||
      combined.includes('urgent') ||
      combined.includes('dispute') ||
      combined.includes('error')
    ) {
      return { level: 'P2', label: 'P2 - High Priority', color: 'amber', icon: 'warning', badgeBg: 'bg-amber-950/60 border-amber-800/80 text-amber-300' };
    }
    return { level: 'P3', label: 'P3 - Standard Request', color: 'blue', icon: 'info', badgeBg: 'bg-blue-950/60 border-blue-800/80 text-blue-300' };
  }, [newSubject, newDescription]);

  // Load all available accounts
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

  // Load tickets specific to the selected tenant
  useEffect(() => {
    async function loadTenantTickets() {
      if (!selectedAccountId) return;
      setLoadingTickets(true);
      try {
        const res = await fetch(`/api/tickets?account_id=${selectedAccountId}`);
        if (res.ok) {
          const data = await res.json();
          setTickets(Array.isArray(data) ? data : []);
        } else {
          setTickets([]);
        }
      } catch (err) {
        console.error('Failed to load tenant tickets:', err);
        setTickets([]);
      } finally {
        setLoadingTickets(false);
      }
    }
    loadTenantTickets();
  }, [selectedAccountId]);

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubject.trim() || creatingTicket) return;

    setCreatingTicket(true);
    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: selectedAccountId,
          subject: newSubject.trim(),
          priority: evaluatedPriority.level,
          description: newDescription.trim() || newSubject.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok && data.ticket) {
        setTickets((prev) => [data.ticket, ...prev.filter((t) => t.ticket_id !== data.ticket.ticket_id)]);
        setShowCreateModal(false);
        setNewSubject('');
        setNewDescription('');
      } else {
        alert(data.error || 'Failed to create ticket.');
      }
    } catch (err: any) {
      alert(err.message || 'Network error creating ticket.');
    } finally {
      setCreatingTicket(false);
    }
  };

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
    `What are my active orders on ${activeAccount.account_id}?`,
    `Can I cancel order ${activeAccount.account_id === 'ACCT-001' ? 'ORD-1001' : 'my shipment'}? What is the cancellation fee?`,
    'What is our contractual SLA response time for P1 critical incidents?',
    'What is the maximum supported CSV limit for bulk shipment uploads?',
    'My shipment was picked up by SwiftShip but still shows BOOKED. Why?',
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

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white bg-[#141414] hover:bg-[#1E1E1E] border border-[#262626] px-2.5 py-1 rounded-full transition"
              title="Toggle Inquiries Sidebar"
            >
              <MaterialIcon name="confirmation_number" className="text-xs text-amber-400" />
              <span>{showSidebar ? 'Hide Inquiries' : `Inquiries (${tickets.length})`}</span>
            </button>

            <div className="flex items-center gap-1.5 text-[10px] font-bitcount text-emerald-400 bg-emerald-950/40 border border-emerald-800/60 px-2.5 py-0.5 rounded-full font-semibold">
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              <span>SERVER-ISOLATED TENANT</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Body: Customer Tickets Sidebar + Chat Interface */}
      <div className="flex-1 min-h-0 flex w-full overflow-hidden">
        {/* Left Customer Tickets Sidebar */}
        {showSidebar && (
          <aside className="w-72 sm:w-80 border-r border-[#1C1C1C] bg-[#0A0A0A] flex flex-col shrink-0 overflow-hidden animate-in slide-in-from-left-2 duration-150">
            {/* Sidebar Header */}
            <div className="p-3.5 border-b border-[#1A1A1A] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MaterialIcon name="support_agent" className="text-base text-zinc-300" />
                <span className="font-bold text-xs text-white">My Inquiries</span>
                <span className="text-[10px] font-bitcount font-bold bg-[#1A1A1A] text-zinc-400 px-1.5 py-0.2 rounded border border-[#2C2C2C]">
                  {tickets.length}
                </span>
              </div>

              {/* Plus Button for New Request / Ticket */}
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#161616] hover:bg-white hover:text-black border border-[#2D2D2D] text-zinc-300 text-xs font-semibold transition shadow-xs group"
                title="Create new support request"
              >
                <MaterialIcon name="add" className="text-sm text-zinc-400 group-hover:text-black" />
                <span className="text-[10px] font-bitcount">NEW</span>
              </button>
            </div>

            {/* Ticket List or Empty State */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {loadingTickets ? (
                <div className="text-center py-8 text-xs text-zinc-500">
                  <MaterialIcon name="sync" className="text-base animate-spin mb-1 text-zinc-400" />
                  <div>Loading inquiries...</div>
                </div>
              ) : tickets.length > 0 ? (
                tickets.map((tkt) => {
                  const isP1 = tkt.priority === 'P1' || tkt.priority === 'CRITICAL';
                  return (
                    <div
                      key={tkt.ticket_id}
                      className="p-3 rounded-xl bg-[#121212] border border-[#242424] hover:border-zinc-500 transition group text-xs space-y-1.5 cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bitcount font-bold text-[11px] text-white group-hover:text-amber-300 transition">
                          {tkt.ticket_id}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {isP1 && (
                            <span className="text-[9px] font-bitcount font-bold px-1.5 py-0.2 rounded bg-rose-950/70 text-rose-300 border border-rose-800/80">
                              P1 CRITICAL
                            </span>
                          )}
                          <span className="text-[9px] font-bitcount px-1.5 py-0.2 rounded bg-[#1C1C1C] text-zinc-300 border border-[#2D2D2D]">
                            {tkt.status}
                          </span>
                        </div>
                      </div>

                      <p className="text-xs text-zinc-300 leading-snug line-clamp-2">
                        {tkt.subject || tkt.description || 'Support Request'}
                      </p>

                      {tkt.created_at && (
                        <div className="text-[10px] text-zinc-500 font-mono">
                          {new Date(tkt.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                /* Empty State when tenant has no open tickets */
                <div className="text-center py-12 px-4 rounded-2xl bg-[#111111] border border-[#202020] space-y-2.5 my-auto">
                  <div className="w-10 h-10 rounded-full bg-[#181818] border border-[#2A2A2A] flex items-center justify-center mx-auto text-zinc-400">
                    <MaterialIcon name="inbox" className="text-xl text-zinc-400" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-white font-google-sans">No Active Tickets</h4>
                    <p className="text-[11px] text-zinc-400 leading-relaxed mt-1">
                      Your open inquiries and support requests will be visible here. Ask a question or report an issue in the chat to start.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Links Footer */}
            <div className="p-3 border-t border-[#1A1A1A] bg-[#0E0E0E] space-y-1.5 text-[11px]">
              <div className="text-[10px] font-bitcount font-semibold text-zinc-500 uppercase tracking-wider">
                QUICK ACCESS
              </div>
              <div className="text-[11px] text-zinc-400 hover:text-white transition flex items-center gap-1.5">
                <MaterialIcon name="inventory_2" className="text-xs text-zinc-500" />
                <span>Type <strong>&ldquo;my orders&rdquo;</strong> to inspect shipments</span>
              </div>
              <div className="text-[11px] text-zinc-400 hover:text-white transition flex items-center gap-1.5">
                <MaterialIcon name="description" className="text-xs text-zinc-500" />
                <span>Type <strong>&ldquo;my contract&rdquo;</strong> for SLA terms</span>
              </div>
            </div>
          </aside>
        )}

        {/* Main Chat Interface (Preserved per Tenant Key) */}
        <main className="flex-1 min-h-0 flex flex-col w-full overflow-hidden">
          <ChatInterface
            key={selectedAccountId}
            session={session}
            title={`${activeAccount.account_name} Assistant`}
            subtitle={`Account-scoped support engine for ${activeAccount.account_id}`}
            accountId={activeAccount.account_id}
            suggestedPrompts={suggestedPrompts}
          />
        </main>
      </div>

      {/* Interactive Create Support Request Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-[#111111] border border-[#2A2A2A] rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 font-google-sans">
            <div className="flex items-center justify-between border-b border-[#222222] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-white/10 text-white flex items-center justify-center">
                  <MaterialIcon name="confirmation_number" className="text-base text-amber-400" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">Create New Support Request</h3>
                  <p className="text-[11px] text-zinc-400 font-mono">{activeAccount.account_name} &bull; {activeAccount.account_id}</p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-zinc-400 hover:text-white p-1"
              >
                <MaterialIcon name="close" className="text-sm" />
              </button>
            </div>

            <form onSubmit={handleCreateTicket} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-medium text-zinc-300 mb-1">
                  Subject / Issue Topic <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  placeholder="e.g. Order ORD-1003 Delayed Pickup or CSV Upload Error"
                  className="w-full bg-[#181818] border border-[#2E2E2E] focus:border-white rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none transition"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-medium text-zinc-300">
                      Priority Level
                    </label>
                    <span className="text-[9px] font-bitcount font-bold text-amber-400 bg-amber-950/40 px-1.5 py-0.2 rounded border border-amber-900/60">
                      AI DETERMINED
                    </span>
                  </div>
                  <div className={`w-full bg-[#141414] border rounded-xl px-3 py-2 text-xs flex items-center gap-2 ${evaluatedPriority.badgeBg}`}>
                    <MaterialIcon name={evaluatedPriority.icon} className="text-sm shrink-0" filled />
                    <span className="font-semibold">{evaluatedPriority.label}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-zinc-300 mb-1">
                    Contract Plan
                  </label>
                  <input
                    type="text"
                    disabled
                    value={`${activeAccount.plan} Tier`}
                    className="w-full bg-[#141414] border border-[#222222] rounded-xl px-3 py-2 text-xs text-zinc-400 cursor-not-allowed font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-300 mb-1">
                  Description &amp; Details
                </label>
                <textarea
                  rows={3}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Provide tracking numbers, error messages, or affected order IDs..."
                  className="w-full bg-[#181818] border border-[#2E2E2E] focus:border-white rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none transition resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#222222]">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-1.5 rounded-full text-xs text-zinc-400 hover:text-white bg-[#1A1A1A] hover:bg-[#222222] border border-[#2F2F2F] transition font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingTicket || !newSubject.trim()}
                  className="px-4 py-1.5 rounded-full text-xs font-semibold text-black bg-white hover:bg-zinc-200 transition shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                >
                  {creatingTicket ? (
                    <>
                      <MaterialIcon name="sync" className="text-xs animate-spin" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <>
                      <MaterialIcon name="send" className="text-xs" filled />
                      <span>Submit Request</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
