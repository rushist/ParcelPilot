'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
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

  // Handle clicking "NEW" chat - directly opens new chat without popups and prevents multiple empty chats
  const handleOpenNewChat = () => {
    if (selectedTicketId === 'new') return; // Already in new chat mode
    setSelectedTicketId('new');
  };

  const handleTicketCreated = (newTicket: TicketRecord) => {
    setTickets((prev) => [newTicket, ...prev.filter((t) => t.ticket_id !== newTicket.ticket_id)]);
    setSelectedTicketId(newTicket.ticket_id);
  };

  const activeAccount = accounts.find((a) => a.account_id === selectedAccountId) || accounts[0] || {
    account_id: 'ACCT-001',
    account_name: 'Northstar Logistics',
    plan: 'Enterprise',
    support_tier: '24/7 Priority',
    contract_file: 'DOC-AGREEMENT-NORTHSTAR.md',
  };

  const isNewChat = selectedTicketId === 'new';
  const activeTicket = !isNewChat ? tickets.find((t) => t.ticket_id === selectedTicketId) || null : null;

  const session: CustomerSession = {
    surface: 'customer',
    account_id: selectedAccountId,
    ticket_id: selectedTicketId && selectedTicketId !== 'new' ? selectedTicketId : undefined,
  };

  const suggestedPrompts = [
    'Shipment was delivered but not updated and payment was done',
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
              onChange={(e) => {
                setSelectedAccountId(e.target.value);
                setSelectedTicketId(null);
              }}
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

              {/* Plus Button for New Request - Direct action, no popup */}
              <button
                onClick={handleOpenNewChat}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-semibold transition shadow-xs group cursor-pointer ${
                  isNewChat
                    ? 'bg-white text-black border-white'
                    : 'bg-[#161616] hover:bg-white hover:text-black border-[#2D2D2D] text-zinc-300'
                }`}
                title="Create new support request"
              >
                <MaterialIcon name="add" className={`text-sm ${isNewChat ? 'text-black' : 'text-zinc-400 group-hover:text-black'}`} />
                <span className="text-[10px] font-bitcount">NEW</span>
              </button>
            </div>

            {/* Conversation Threads List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {/* Active Draft / New Request Thread Indicator (Only shown if currently in new chat mode) */}
              {isNewChat && (
                <div
                  className="p-3 rounded-xl border border-white bg-white text-black shadow-md space-y-1.5 cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bitcount font-extrabold text-[11px] flex items-center gap-1.5 text-black">
                      <MaterialIcon name="add_comment" className="text-xs text-black" />
                      <span>NEW INQUIRY</span>
                    </span>
                    <span className="text-[9px] font-bitcount font-bold px-1.5 py-0.2 rounded bg-black/10 text-black border border-black/20 animate-pulse">
                      DRAFTING
                    </span>
                  </div>
                  <p className="text-xs text-zinc-800 font-medium">
                    Write query below to register &amp; triage request
                  </p>
                </div>
              )}

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
              isNewChat
                ? 'New Support Request'
                : activeTicket
                ? `Inquiry ${activeTicket.ticket_id}`
                : `${activeAccount.account_name} Assistant`
            }
            subtitle={
              isNewChat
                ? 'Type your query below. AI will automatically evaluate severity and resolve or escalate.'
                : activeTicket
                ? `${activeTicket.priority || 'P2'} Severity &bull; ${activeTicket.subject}`
                : `Account-scoped support engine for ${activeAccount.account_id}`
            }
            accountId={activeAccount.account_id}
            ticketId={selectedTicketId || undefined}
            suggestedPrompts={suggestedPrompts}
            onTicketCreated={handleTicketCreated}
          />
        </main>
      </div>
    </div>
  );
}
