'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { ChatInterface } from '@/components/chat/ChatInterface';
import { CustomerSession } from '@/types';
import { AccountRecord, TicketRecord } from '@/db/schema';
import { MaterialIcon } from '@/components/ui/MaterialIcon';

export default function CustomerChatPage() {
  const [accounts, setAccounts] = useState<AccountRecord[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('ACCT-001');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [tickets, setTickets] = useState<TicketRecord[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);

  // Ticket creation modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [creatingTicket, setCreatingTicket] = useState(false);

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

  // Load tickets specific to the selected tenant (only active open tickets)
  useEffect(() => {
    async function loadTenantTickets() {
      if (!selectedAccountId) return;
      try {
        const res = await fetch(`/api/tickets?account_id=${selectedAccountId}&status=open`);
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
    setLoadingTickets(true);
    loadTenantTickets();
    const interval = setInterval(loadTenantTickets, 3500);
    return () => clearInterval(interval);
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
          description: newDescription.trim() || newSubject.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok && data.ticket) {
        setTickets((prev) => [data.ticket, ...prev.filter((t) => t.ticket_id !== data.ticket.ticket_id)]);
        setSelectedTicketId(data.ticket.ticket_id);
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
    support_tier: '24/7 Priority',
    contract_file: 'DOC-AGREEMENT-NORTHSTAR.md',
  };

  const activeTicket = tickets.find((t) => t.ticket_id === selectedTicketId) || null;

  const session: CustomerSession = {
    surface: 'customer',
    account_id: selectedAccountId,
    ticket_id: selectedTicketId || undefined,
  };

  const suggestedPrompts = [
    'What is our governing SLA target under our enterprise agreement?',
    'What is the cancellation fee for order ORD-1003?',
    'Can you list all my recent orders and delivery statuses?',
    'Why is order ORD-1001 showing delayed pickup?',
  ];

  return (
    <div className="h-screen w-screen bg-[#050505] text-white flex flex-col font-google-sans overflow-hidden">
      {/* Top Banner & Multi-Tenant Switcher */}
      <header className="h-14 border-b border-[#1A1A1A] bg-[#0A0A0A] px-4 sm:px-6 lg:px-8 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-2 text-zinc-400 hover:text-white transition group"
            title="Return to Calquity Gateway"
          >
            <div className="w-8 h-8 rounded-xl bg-white text-black flex items-center justify-center font-bold text-xs shadow-xs group-hover:scale-105 transition-transform font-bitcount">
              CP
            </div>
            <div className="hidden sm:block">
              <span className="font-bold text-sm tracking-tight text-white block leading-none">
                CALQUITY
              </span>
              <span className="text-[10px] text-zinc-400 font-bitcount block leading-tight mt-0.5">
                CUSTOMER PORTAL
              </span>
            </div>
          </Link>

          <div className="h-4 w-px bg-[#262626] mx-1 hidden sm:block" />

          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-white" />
            <span className="text-xs font-semibold text-zinc-200">
              Merchant Self-Service Support
            </span>
          </div>
        </div>

        {/* Global Nav Links & Tenant Selector */}
        <div className="flex items-center gap-4">
          <nav className="hidden md:flex items-center gap-4 text-xs">
            <Link
              href="/internal"
              className="text-zinc-400 hover:text-white transition flex items-center gap-1.5 font-medium"
            >
              <MaterialIcon name="terminal" className="text-xs text-zinc-500" />
              <span>Internal System</span>
            </Link>
            <Link
              href="/internal/insights"
              className="text-zinc-400 hover:text-white transition flex items-center gap-1.5 font-medium"
            >
              <MaterialIcon name="radar" className="text-xs text-zinc-500" />
              <span>SLA Radar</span>
            </Link>
          </nav>

          <div className="h-4 w-px bg-[#262626] hidden md:block" />

          {/* Account Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400 hidden sm:inline font-bitcount">
              TENANT:
            </span>
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              disabled={loadingAccounts}
              className="bg-[#141414] border border-[#2A2A2A] text-xs text-white rounded-full px-3.5 py-1.5 focus:outline-none focus:border-white font-medium shadow-sm max-w-[200px]"
            >
              {accounts.map((acc) => (
                <option key={acc.account_id} value={acc.account_id}>
                  {acc.account_id} — {acc.account_name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {/* Main Body: Customer Tickets Sidebar (Messaging Threads) + Chat Interface */}
      <div className="flex-1 min-h-0 flex w-full overflow-hidden">
        {/* Left Customer Tickets Sidebar */}
        {showSidebar && (
          <aside className="w-72 sm:w-80 border-r border-[#1C1C1C] bg-[#0A0A0A] flex flex-col shrink-0 overflow-hidden animate-in slide-in-from-left-2 duration-150">
            {/* Sidebar Header */}
            <div className="p-3.5 border-b border-[#1A1A1A] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MaterialIcon name="forum" className="text-base text-zinc-300" />
                <span className="font-bold text-xs text-white">Support Threads</span>
                <span className="text-[10px] font-bitcount font-bold bg-[#1A1A1A] text-zinc-400 px-1.5 py-0.2 rounded border border-[#2C2C2C]">
                  {tickets.length}
                </span>
              </div>

              {/* Plus Button for New Request / Ticket */}
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#161616] hover:bg-white hover:text-black border border-[#2D2D2D] text-zinc-300 text-xs font-semibold transition shadow-xs group cursor-pointer"
                title="Create new support request"
              >
                <MaterialIcon name="add" className="text-sm text-zinc-400 group-hover:text-black" />
                <span className="text-[10px] font-bitcount">NEW</span>
              </button>
            </div>

            {/* Conversation Threads List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {/* General Account Channel Thread */}
              <div
                onClick={() => setSelectedTicketId(null)}
                className={`p-3 rounded-xl border transition group text-xs space-y-1 cursor-pointer ${
                  selectedTicketId === null
                    ? 'bg-white text-black border-white shadow-sm font-semibold'
                    : 'bg-[#121212] border-[#242424] text-zinc-300 hover:border-zinc-500'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bitcount font-bold text-[11px] flex items-center gap-1.5">
                    <MaterialIcon name="chat" className="text-xs" />
                    <span>General Inquiries</span>
                  </span>
                  <span className={`text-[9px] font-bitcount px-1.5 py-0.2 rounded ${
                    selectedTicketId === null ? 'bg-black/10 text-black font-bold' : 'bg-[#1C1C1C] text-zinc-400'
                  }`}>
                    CHANNEL
                  </span>
                </div>
                <p className={`text-[11px] truncate ${selectedTicketId === null ? 'text-zinc-800 font-normal' : 'text-zinc-400'}`}>
                  Live assistant for general tracking, contract terms &amp; fee checks
                </p>
              </div>

              {loadingTickets ? (
                <div className="text-center py-8 text-xs text-zinc-500">
                  <MaterialIcon name="sync" className="text-base animate-spin mb-1 text-zinc-400" />
                  <div>Loading inquiries...</div>
                </div>
              ) : tickets.length > 0 ? (
                tickets.map((tkt) => {
                  const isSelected = selectedTicketId === tkt.ticket_id;
                  const isP1 = tkt.priority === 'P1' || tkt.priority === 'CRITICAL';
                  return (
                    <div
                      key={tkt.ticket_id}
                      onClick={() => setSelectedTicketId(tkt.ticket_id)}
                      className={`p-3 rounded-xl border transition group text-xs space-y-1.5 cursor-pointer ${
                        isSelected
                          ? 'bg-white text-black border-white shadow-md'
                          : 'bg-[#121212] border-[#242424] hover:border-zinc-500'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`font-bitcount font-bold text-[11px] ${
                          isSelected ? 'text-black font-extrabold' : 'text-white group-hover:text-amber-300'
                        }`}>
                          {tkt.ticket_id}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {isP1 && (
                            <span className={`text-[9px] font-bitcount font-bold px-1.5 py-0.2 rounded ${
                              isSelected ? 'bg-rose-600 text-white' : 'bg-rose-950/70 text-rose-300 border border-rose-800/80'
                            }`}>
                              P1 CRITICAL
                            </span>
                          )}
                          <span className={`text-[9px] font-bitcount px-1.5 py-0.2 rounded ${
                            isSelected ? 'bg-black/10 text-black border border-black/20 font-bold' : 'bg-[#1C1C1C] text-zinc-300 border border-[#2D2D2D]'
                          }`}>
                            {tkt.status}
                          </span>
                        </div>
                      </div>

                      <p className={`text-xs leading-snug line-clamp-2 ${
                        isSelected ? 'text-zinc-900 font-medium' : 'text-zinc-300'
                      }`}>
                        {tkt.subject || tkt.description || 'Support Request'}
                      </p>

                      {tkt.created_at && (
                        <div className={`text-[10px] font-mono ${isSelected ? 'text-zinc-600 font-bold' : 'text-zinc-500'}`}>
                          {new Date(tkt.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : null}
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
            </div>
          </aside>
        )}

        {/* Main Chat Interface (Thread Isolated per Ticket Key) */}
        <main className="flex-1 min-h-0 flex flex-col w-full overflow-hidden">
          <ChatInterface
            key={`${selectedAccountId}_${selectedTicketId || 'main'}`}
            session={session}
            title={
              activeTicket
                ? `Inquiry ${activeTicket.ticket_id}`
                : `${activeAccount.account_name} Assistant`
            }
            subtitle={
              activeTicket
                ? `${activeTicket.priority || 'P2'} Severity &bull; ${activeTicket.subject}`
                : `Account-scoped support engine for ${activeAccount.account_id}`
            }
            accountId={activeAccount.account_id}
            ticketId={selectedTicketId || undefined}
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
                disabled={creatingTicket}
                className="text-zinc-400 hover:text-white p-1"
              >
                <MaterialIcon name="close" className="text-sm" />
              </button>
            </div>

            {/* AI Triage Pulse State while submitting */}
            {creatingTicket && (
              <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-800/60 text-amber-200 text-xs flex items-center gap-2.5 animate-pulse">
                <MaterialIcon name="auto_awesome" className="text-base text-amber-400 shrink-0" />
                <div>
                  <div className="font-bold text-amber-300">AI Triage Engine Active</div>
                  <div className="text-[11px] text-amber-200/80">Evaluating incident severity against SOP v4 &amp; SLA terms...</div>
                </div>
              </div>
            )}

            <form onSubmit={handleCreateTicket} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-medium text-zinc-300 mb-1">
                  Subject / Issue Topic <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  disabled={creatingTicket}
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  placeholder="e.g. Order ORD-1003 Delayed Pickup or CSV Upload Error"
                  className="w-full bg-[#181818] border border-[#2E2E2E] focus:border-white rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none transition disabled:opacity-50"
                  autoFocus
                />
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

              <div>
                <label className="block text-[11px] font-medium text-zinc-300 mb-1">
                  Description &amp; Details
                </label>
                <textarea
                  rows={3}
                  disabled={creatingTicket}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Provide tracking numbers, error messages, or affected order IDs..."
                  className="w-full bg-[#181818] border border-[#2E2E2E] focus:border-white rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none transition resize-none disabled:opacity-50"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#222222]">
                <button
                  type="button"
                  disabled={creatingTicket}
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-1.5 rounded-full text-xs text-zinc-400 hover:text-white bg-[#1A1A1A] hover:bg-[#222222] border border-[#2F2F2F] transition font-medium disabled:opacity-50"
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
                      <span>Triaging &amp; Logging...</span>
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
