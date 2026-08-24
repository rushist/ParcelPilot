'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  RefreshCw,
  Loader2,
  ChevronUp,
  ChevronDown,
  X,
  FileCode,
  Flame,
  Clock,
  ShieldAlert,
  ArrowRight,
  Sparkles,
  Layers,
  Package,
  FileText,
  Building,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { MaterialIcon } from '../ui/MaterialIcon';
import { SessionContext } from '@/types';
import { ToolBadge } from '../tools/ToolBadge';
import { ConfirmationCard } from '../confirmation/ConfirmationCard';
import { FormattedMessage } from './FormattedMessage';
import { ToolExecutionTrace } from '@/agent/tools/data-tools';
import { ProposedActionResponse } from '@/actions/propose';
import { TicketRecord, OrderRecord } from '@/db/schema';

export interface MessageItem {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  tool_traces?: ToolExecutionTrace[];
  sources?: any[];
  proposed_action?: ProposedActionResponse;
  timestamp: string;
  timeLabel?: string;
  speakerLabel?: string;
  isSecurityAlert?: boolean;
  isError?: boolean;
}

export function ChatInterface({
  session,
  title,
  subtitle,
  accountId,
  ticketId,
  suggestedPrompts = [],
  onSelectTicketPrompt,
  onTicketClosed,
  onTicketCreated,
}: {
  session: SessionContext;
  title: string;
  subtitle: string;
  accountId?: string;
  ticketId?: string;
  suggestedPrompts?: string[];
  onSelectTicketPrompt?: (query: string) => void;
  onTicketClosed?: (ticketId: string) => void;
  onTicketCreated?: (ticket: TicketRecord) => void;
}) {
  const isInternal = session.surface === 'internal';
  const effectiveAccountId = session.surface === 'customer' ? session.account_id : accountId;
  const effectiveTicketId = session.ticket_id || ticketId;

  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPromptsMenu, setShowPromptsMenu] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [hasAlert, setHasAlert] = useState(false);

  // Account-scoped tickets & orders state (for internal scoped investigation)
  const [accountTickets, setAccountTickets] = useState<TicketRecord[]>([]);
  const [accountOrders, setAccountOrders] = useState<OrderRecord[]>([]);
  const [loadingScopedData, setLoadingScopedData] = useState(false);

  const [radarData, setRadarData] = useState<{
    slaItems: any[];
    spikeClusters: any[];
    securityCount: number;
  }>({
    slaItems: [
      { ticket_id: 'TKT-501', account_id: 'ACCT-001', account_name: 'Northstar Logistics', subject: 'P1 Outage: Bulk shipment validation failure', status: 'BREACHED', elapsed_minutes: 18, target_minutes: 15 },
      { ticket_id: 'TKT-505', account_id: 'ACCT-005', account_name: 'Axis Labs', subject: 'Possible API key exposure in staging webhook', status: 'BREACHED', elapsed_minutes: 22, target_minutes: 15 },
      { ticket_id: 'TKT-502', account_id: 'ACCT-002', account_name: 'LumenWorks', subject: 'Pickup delayed >4 hours on express cargo', status: 'AT_RISK', elapsed_minutes: 48, target_minutes: 60 },
      { ticket_id: 'TKT-503', account_id: 'ACCT-003', account_name: 'Vortex Global', subject: 'Return to origin routing stuck at hub', status: 'AT_RISK', elapsed_minutes: 52, target_minutes: 60 },
    ],
    spikeClusters: [
      { topic: 'Bulk CSV Upload Failures', count: 18, ki_id: 'KI-208' },
      { topic: 'SwiftShip Webhook Lags', count: 14, ki_id: 'KI-211' },
      { topic: 'API 500 Outages', count: 7 },
    ],
    securityCount: 4,
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const promptsMenuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input on initial mount and capture global typing anywhere on the page
  useEffect(() => {
    inputRef.current?.focus();

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Ignore modifier combinations like Ctrl+C, Ctrl+V, Alt+Tab, etc.
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (e.key === 'Escape') {
        inputRef.current?.blur();
        setShowPromptsMenu(false);
        return;
      }

      const activeEl = document.activeElement;
      const isInputActive =
        activeEl instanceof HTMLInputElement ||
        activeEl instanceof HTMLTextAreaElement ||
        activeEl?.getAttribute('contenteditable') === 'true';

      if (!isInputActive) {
        // If a single printable character is typed
        if (e.key.length === 1 && !e.repeat) {
          inputRef.current?.focus();
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // Fetch account-scoped data if viewing an account-specific tab on internal surface
  useEffect(() => {
    async function loadAccountData() {
      if (!isInternal || !effectiveAccountId) return;
      setLoadingScopedData(true);
      try {
        const [tktRes, ordRes] = await Promise.all([
          fetch(`/api/tickets?account_id=${effectiveAccountId}`),
          fetch(`/api/orders?account_id=${effectiveAccountId}`),
        ]);
        if (tktRes.ok) {
          const tkts = await tktRes.json();
          setAccountTickets(tkts);
        }
        if (ordRes.ok) {
          const ords = await ordRes.json();
          setAccountOrders(ords);
        }
      } catch (err) {
        console.error('Failed to load scoped account data:', err);
      } finally {
        setLoadingScopedData(false);
      }
    }
    loadAccountData();
  }, [isInternal, effectiveAccountId]);

  // Latest turn analysis state for the right panel
  const [activeAnalysis, setActiveAnalysis] = useState<{
    feeText: string;
    feeSub: string;
    creditText: string;
    creditSub: string;
    slaText: string;
    slaSub: string;
    sources: any[];
    proposedAction?: ProposedActionResponse;
    tools: ToolExecutionTrace[];
  }>({
    feeText: effectiveAccountId === 'ACCT-001' ? '₹0 fee' : '₹250 fee',
    feeSub: effectiveAccountId === 'ACCT-001' ? 'Signed Agreement Waiver' : 'Standard SOP v4',
    creditText: effectiveAccountId === 'ACCT-002' ? '₹300/4h' : 'Standard',
    creditSub: effectiveAccountId === 'ACCT-002' ? 'LumenWorks Agreement' : 'SOP Policy',
    slaText: effectiveAccountId === 'ACCT-001' ? '15 min' : '60 min',
    slaSub: effectiveAccountId === 'ACCT-001' ? 'Contract P1 Target' : 'Standard SLA',
    sources: [],
    tools: [],
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Real-time synchronization between Customer and Internal surfaces
  const syncMessages = async () => {
    const targetId = effectiveAccountId || 'ACCT-001';
    const activeRole = isInternal ? (session as any).role || 'support' : undefined;
    const roleParam = activeRole ? `&role=${activeRole}` : '';
    const ticketParam = effectiveTicketId ? `&ticket_id=${effectiveTicketId}` : '';
    try {
      const res = await fetch(`/api/chat?account_id=${targetId}${roleParam}${ticketParam}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.messages)) {
          setMessages(data.messages);
          // Sync sidecar proposed action if present in the history and not already executed
          const lastActionMsg = [...data.messages].reverse().find((m) => m.proposed_action);
          const hasBeenExecuted = data.messages.some((m: any) =>
            m.isActionConfirmation ||
            m.content?.includes('Action Executed') ||
            (lastActionMsg?.proposed_action?.action_id && m.content?.includes(lastActionMsg.proposed_action.action_id))
          );

          if (lastActionMsg?.proposed_action && !hasBeenExecuted) {
            setActiveAnalysis((prev) => ({
              ...prev,
              proposedAction: lastActionMsg.proposed_action,
            }));
          } else if (hasBeenExecuted) {
            setActiveAnalysis((prev) => ({
              ...prev,
              proposedAction: undefined,
            }));
          }
        }
      }
    } catch (e) {
      // Ignore polling hiccups
    }
  };

  useEffect(() => {
    syncMessages();
    const interval = setInterval(syncMessages, 2500);
    return () => clearInterval(interval);
  }, [effectiveAccountId, (session as any).role, effectiveTicketId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (promptsMenuRef.current && !promptsMenuRef.current.contains(event.target as Node)) {
        setShowPromptsMenu(false);
      }
    }
    if (showPromptsMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showPromptsMenu]);

  const getTimeLabel = () => {
    return new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  };

  const handleSendMessage = async (textToSend?: string) => {
    const messageContent = textToSend || input.trim();
    if (!messageContent || loading) return;

    setShowPromptsMenu(false);
    setInput('');
    setTimeout(() => inputRef.current?.focus(), 10);
    setLoading(true);
    setHasAlert(false);

    try {
      const historyPayload = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session: {
            ...session,
            account_id: effectiveAccountId,
            ticket_id: effectiveTicketId === 'new' ? undefined : effectiveTicketId,
          },
          message: messageContent,
          history: historyPayload,
          ticket_id: effectiveTicketId === 'new' ? undefined : effectiveTicketId,
          create_new_ticket: !isInternal && (effectiveTicketId === 'new' || !effectiveTicketId),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to get agent response.');
      }

      if (data.created_ticket && onTicketCreated) {
        onTicketCreated(data.created_ticket);
      }

      const isSecurityOrTrap =
        data.message.includes('P1 Critical') ||
        data.message.includes('Security') ||
        data.message.includes('unauthorized') ||
        data.message.includes('strictly prohibited');

      if (isSecurityOrTrap) {
        setHasAlert(true);
      }

      // Re-sync conversation immediately after server responds
      await syncMessages();

      // Update right panel analysis metrics dynamically from turn traces
      let feeDisplay = effectiveAccountId === 'ACCT-001' ? '₹0 fee' : '₹250 fee';
      let feeSub = effectiveAccountId === 'ACCT-001' ? 'Signed Agreement Waiver' : 'Standard SOP v4';
      let creditDisplay = effectiveAccountId === 'ACCT-002' ? '₹300/4h' : 'Standard';
      let creditSub = effectiveAccountId === 'ACCT-002' ? 'LumenWorks Agreement' : 'SOP Policy';
      let slaDisplay = effectiveAccountId === 'ACCT-001' ? '15 min' : '60 min';
      let slaSub = effectiveAccountId === 'ACCT-001' ? 'Northstar Contract P1' : 'Standard SLA';

      if (data.message.includes('₹0') || data.message.includes('INR 0') || data.message.includes('no cancellation fee')) {
        feeDisplay = '₹0 fee';
        feeSub = 'Signed Agreement Waiver';
      } else if (data.message.includes('250') || data.message.includes('₹250')) {
        feeDisplay = '₹250 fee';
        feeSub = 'Standard SOP v4';
      }

      if (data.message.includes('300') || data.message.includes('₹300')) {
        creditDisplay = '₹300 credit';
        creditSub = 'LumenWorks Agreement';
      } else if (data.message.includes('disputed') || data.message.includes('NEEDS_VERIFICATION')) {
        creditDisplay = 'Pending';
        creditSub = 'Needs Verification';
      }

      if (data.message.includes('15') || data.message.includes('15m') || data.message.includes('15 min')) {
        slaDisplay = '15 min';
        slaSub = 'Northstar Contract P1';
      }

      setActiveAnalysis((prev) => ({
        feeText: feeDisplay,
        feeSub,
        creditText: creditDisplay,
        creditSub,
        slaText: slaDisplay,
        slaSub,
        sources: data.sources?.length ? data.sources : prev.sources,
        proposedAction: data.proposed_action || prev.proposedAction,
        tools: data.tool_traces?.length ? data.tool_traces : prev.tools,
      }));
    } catch (err: any) {
      setHasAlert(true);
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: `Error: ${err.message || 'Unable to connect to assistant service.'}`,
          timestamp: new Date().toISOString(),
          timeLabel: 'ERR',
          speakerLabel: 'SYSTEM',
          isError: true,
        },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleClearChat = async () => {
    setMessages([]);
    setHasAlert(false);
    setActiveAnalysis({
      feeText: effectiveAccountId === 'ACCT-001' ? '₹0 fee' : '₹250 fee',
      feeSub: effectiveAccountId === 'ACCT-001' ? 'Signed Waiver' : 'Standard SOP',
      creditText: effectiveAccountId === 'ACCT-002' ? '₹300/4h' : 'Eligible',
      creditSub: effectiveAccountId === 'ACCT-002' ? 'LumenWorks Agreement' : 'SOP Policy',
      slaText: effectiveAccountId === 'ACCT-001' ? '15 min' : '60 min',
      slaSub: effectiveAccountId === 'ACCT-001' ? 'Contract SLA' : 'Standard SLA',
      sources: [],
      tools: [],
    });
    try {
      await fetch('/api/reset', { method: 'POST' });
      window.location.reload();
    } catch (e) {
      console.warn('Failed to reset system:', e);
    }
  };

  // Dynamically load live SLA risk radar and topic spikes from real database state
  useEffect(() => {
    async function loadLiveRadar() {
      if (!isInternal) return;
      try {
        const [slaRes, spikeRes] = await Promise.all([
          fetch('/api/insights?type=sla_at_risk'),
          fetch('/api/insights?type=spike_by_topic'),
        ]);
        if (slaRes.ok && spikeRes.ok) {
          const slaData = await slaRes.json();
          const spikeData = await spikeRes.json();
          if (Array.isArray(slaData.data?.items)) {
            setRadarData((prev) => ({
              ...prev,
              slaItems: slaData.data.items,
              spikeClusters: (spikeData.data?.clusters || []).map((c: any) => ({
                topic: c.topic,
                count: c.count,
                ki_id: c.known_issue_id,
              })),
            }));
          }
        }
      } catch (e) {
        // Ignore polling errors
      }
    }
    loadLiveRadar();
    const interval = setInterval(loadLiveRadar, 3500);
    return () => clearInterval(interval);
  }, [isInternal, effectiveAccountId]);

  return (
    <div className="flex flex-col flex-1 w-full max-w-full overflow-hidden bg-[#050505] h-full min-h-0 font-google-sans text-white px-2 sm:px-4 lg:px-6 py-2">
      {/* Main Workspace Window Container */}
      <div className="flex-1 flex flex-col w-full bg-[#0A0A0A] border border-[#1F1F1F] rounded-2xl shadow-[0_10px_35px_rgba(0,0,0,0.5)] overflow-hidden min-h-0 h-full">
        {/* Window Top Bar with Reactive Traffic Light Dots */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-[#1F1F1F] bg-[#080808] shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 truncate mr-2">
            {/* Dynamic Traffic Light Status Dots: Red / Yellow / Green */}
            <div className="flex items-center gap-1.5 shrink-0" title="System Status: Red (Alert) • Yellow (Evaluating) • Green (Ready)">
              {/* RED DOT: Guardrail / Security Alert / Error */}
              <span
                className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                  hasAlert
                    ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.9)] animate-pulse'
                    : 'bg-rose-950/40 border border-rose-900/40 hover:bg-rose-600'
                }`}
                title={hasAlert ? 'Security Alert / Policy Guardrail Triggered' : 'Security Guardrail: Active'}
              />

              {/* YELLOW DOT: Agent Thinking & Deterministic Evaluating */}
              <span
                className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                  loading
                    ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.9)] animate-pulse'
                    : 'bg-amber-950/40 border border-amber-900/40 hover:bg-amber-500'
                }`}
                title={loading ? 'Agent Evaluating & Executing Tools...' : 'Deterministic Engine: Standing By'}
              />

              {/* GREEN DOT: User Can Ask / Agent Ready & Live */}
              <span
                className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                  !loading && !hasAlert
                    ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse'
                    : 'bg-emerald-950/40 border border-emerald-900/40 hover:bg-emerald-500'
                }`}
                title="System Ready: You can ask a question"
              />
            </div>

            <div className="h-3 w-px bg-[#262626] shrink-0" />
            <span className="text-[10px] sm:text-[11px] font-bitcount font-bold tracking-wider text-zinc-400 uppercase truncate">
              PARCELPILOT &bull; {effectiveAccountId ? `TENANT: ${effectiveAccountId}` : 'GLOBAL INVESTIGATION'} &bull; {session.surface === 'customer' ? 'CUSTOMER PORTAL' : `ROLE: ${(session as any).role?.toUpperCase()}`}
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Close Request Button: Internal Operations Only, Styled in Red with Confirmation Modal */}
            {isInternal && (
              <button
                onClick={() => setShowCloseModal(true)}
                className="text-xs px-3 py-1 rounded-full bg-rose-950/50 hover:bg-rose-900/70 border border-rose-800/80 text-rose-300 font-bitcount font-semibold flex items-center gap-1.5 transition shadow-xs hover:border-rose-600"
                title="Close and resolve current ticket/inquiry"
              >
                <MaterialIcon name="close" className="text-sm text-rose-400" />
                <span className="hidden sm:inline">CLOSE REQUEST</span>
              </button>
            )}

            <button
              onClick={handleClearChat}
              className="text-zinc-400 hover:text-white transition text-xs p-1 rounded hover:bg-[#1A1A1A] flex items-center gap-1"
              title="Reset system to original pristine state"
            >
              <MaterialIcon name="restart_alt" className="text-sm text-zinc-400" />
              <span className="hidden sm:inline text-[11px] font-medium font-bitcount">RESET</span>
            </button>
          </div>
        </div>

        {/* Grid Layout: 3-Column on Internal, Clean 2-Column on Customer */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-[#1F1F1F] overflow-hidden">
          
          {/* LEFT PANEL: Proactive Ticket Radar (ONLY RENDERED ON INTERNAL SURFACE) */}
          {isInternal && (
            <div className="hidden lg:flex lg:col-span-4 xl:col-span-3 flex-col bg-[#070707] p-4 space-y-4 justify-between shrink-0 overflow-y-auto min-h-0">
              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between pb-2 border-b border-[#1C1C1C]">
                  <div className="flex items-center gap-1.5 text-xs font-bitcount font-bold text-white uppercase tracking-wider truncate mr-2">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span className="truncate">{effectiveAccountId ? `${effectiveAccountId} RADAR` : 'GLOBAL RADAR'}</span>
                  </div>
                  <span className="text-[9px] font-bitcount text-zinc-400 bg-[#141414] px-1.5 py-0.5 rounded border border-[#262626] shrink-0">
                    {effectiveAccountId ? 'TENANT-SCOPED' : 'ALL ACCOUNTS'}
                  </span>
                </div>

                {/* Dynamic Content Based on Whether An Organization Tab or Global Is Selected */}
                {effectiveAccountId ? (
                  /* ORGANIZATION-SCOPED ISSUES & SHIPMENTS */
                  <div className="space-y-3.5">
                    {/* Account Open Tickets */}
                    <div className="space-y-1.5">
                      <div className="text-[10px] font-bitcount font-bold text-zinc-500 uppercase tracking-wider flex items-center justify-between">
                        <span>OPEN TICKETS & SLA</span>
                        <span className="text-amber-400 font-bold font-bitcount">
                          {accountTickets.length > 0 ? `${accountTickets.length} TICKETS` : 'ACTIVE TKT-501'}
                        </span>
                      </div>

                      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                        {accountTickets.length > 0 ? (
                          accountTickets.map((tkt) => (
                            <button
                              key={tkt.ticket_id}
                              onClick={() => {
                                if (onSelectTicketPrompt) onSelectTicketPrompt(tkt.ticket_id);
                                handleSendMessage(`Check SLA status, governing contract, and resolve ticket ${tkt.ticket_id}.`);
                              }}
                              className="w-full text-left p-2.5 rounded-xl bg-[#0F0F0F] hover:bg-[#181818] border border-[#222222] hover:border-[#383838] transition group text-xs space-y-1"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bitcount text-[10px] font-bold text-white group-hover:text-amber-300 transition">
                                  {tkt.ticket_id}
                                </span>
                                <span className="text-[9px] font-bitcount px-1.5 py-0.2 rounded font-bold bg-amber-950/60 text-amber-300 border border-amber-800/80 uppercase">
                                  {tkt.status || 'OPEN'}
                                </span>
                              </div>
                              <div className="text-[11px] text-zinc-300 truncate">{tkt.subject}</div>
                              <div className="text-[9px] text-zinc-500 font-bitcount">Status: {tkt.status}</div>
                            </button>
                          ))
                        ) : (
                          /* Fallback Scoped Sample Ticket for ACCT-001 / ACCT-002 */
                          <button
                            onClick={() => handleSendMessage(`Check SLA status and governing contract terms for ticket TKT-501 (${effectiveAccountId}).`)}
                            className="w-full text-left p-2.5 rounded-xl bg-[#0F0F0F] hover:bg-[#181818] border border-[#222222] hover:border-[#383838] transition group text-xs space-y-1"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bitcount text-[10px] font-bold text-white group-hover:text-amber-300 transition">
                                {effectiveAccountId === 'ACCT-001' ? 'TKT-501' : 'TKT-502'}
                              </span>
                              <span className="text-[9px] font-bitcount px-1.5 py-0.2 rounded font-bold bg-rose-950/60 text-rose-300 border border-rose-800/80">
                                {effectiveAccountId === 'ACCT-001' ? '18m / 15m BREACHED' : '48m / 60m AT RISK'}
                              </span>
                            </div>
                            <div className="text-[11px] text-zinc-300 truncate">
                              {effectiveAccountId === 'ACCT-001' ? 'P1 Outage: Bulk shipment validation failure' : 'Pickup delayed >4 hours on express cargo'}
                            </div>
                            <div className="text-[9px] text-zinc-500 font-bitcount">Click to auto-triage in chat</div>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Account Recent Shipments & Fee Previews */}
                    <div className="space-y-1.5 pt-2 border-t border-[#1C1C1C]">
                      <div className="text-[10px] font-bitcount font-bold text-zinc-500 uppercase tracking-wider flex items-center justify-between">
                        <span>RECENT SHIPMENTS</span>
                        <span className="text-zinc-400 font-bold font-bitcount">
                          {accountOrders.length > 0 ? `${accountOrders.length} ORDERS` : 'ORD-1001'}
                        </span>
                      </div>

                      <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                        {accountOrders.length > 0 ? (
                          accountOrders.slice(0, 3).map((ord) => (
                            <button
                              key={ord.order_id}
                              onClick={() => handleSendMessage(`What is the cancellation fee and status for order ${ord.order_id}?`)}
                              className="w-full text-left p-2 rounded-xl bg-[#0F0F0F] hover:bg-[#181818] border border-[#222222] hover:border-[#383838] transition flex items-center justify-between text-xs group"
                            >
                              <div className="truncate mr-2">
                                <span className="text-zinc-200 group-hover:text-white font-bitcount font-bold block truncate text-[11px]">
                                  {ord.order_id}
                                </span>
                                <span className="text-[9px] text-zinc-400 font-google-sans">Carrier: {ord.carrier || 'SwiftShip'}</span>
                              </div>
                              <span className="text-[9px] font-bitcount text-white font-bold bg-[#1C1C1C] px-1.5 py-0.5 rounded border border-[#2E2E2E] shrink-0">
                                {ord.status}
                              </span>
                            </button>
                          ))
                        ) : (
                          <button
                            onClick={() => handleSendMessage(`Can I cancel order ORD-1001 and what is the fee?`)}
                            className="w-full text-left p-2 rounded-xl bg-[#0F0F0F] hover:bg-[#181818] border border-[#222222] hover:border-[#383838] transition flex items-center justify-between text-xs group"
                          >
                            <div className="truncate mr-2">
                              <span className="text-zinc-200 group-hover:text-white font-bitcount font-bold block truncate text-[11px]">
                                {effectiveAccountId === 'ACCT-001' ? 'ORD-1001' : 'ORD-2002'}
                              </span>
                              <span className="text-[9px] text-zinc-400 font-google-sans">Status: BOOKED</span>
                            </div>
                            <span className="text-[9px] font-bitcount text-emerald-300 font-bold bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-900/60 shrink-0">
                              {effectiveAccountId === 'ACCT-001' ? '₹0 WAIVER' : 'SOP POLICY'}
                            </span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Account Governing Contract Terms Capsule */}
                    <div className="p-2.5 rounded-xl bg-[#121212] border border-[#262626] space-y-1 text-xs">
                      <div className="text-[9px] font-bitcount font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1">
                        <FileText className="w-3 h-3 text-amber-400" />
                        <span>GOVERNING CONTRACT</span>
                      </div>
                      <div className="text-[11px] text-zinc-200 leading-snug">
                        {effectiveAccountId === 'ACCT-001'
                          ? 'Northstar Agreement Section 2: Zero-fee cancellation pre-pickup (Rank 1 Override).'
                          : effectiveAccountId === 'ACCT-002'
                          ? 'LumenWorks Agreement Section 3: ₹300 credit per 4-hour delay (Rank 1 Override).'
                          : 'Standard Support Policy v3 & SOP v4: ₹250 cancellation fee.'}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* GLOBAL PLATFORM-WIDE RADAR ISSUES (When on Global Investigation) */
                  <div className="space-y-4">
                    {/* At Risk & Breached SLA Tickets List */}
                    <div className="space-y-2">
                      <div className="text-[10px] font-bitcount font-bold text-zinc-500 uppercase tracking-wider flex items-center justify-between">
                        <span>AT-RISK / BREACHED TICKETS</span>
                        <span className="text-rose-400 font-bold">{radarData.slaItems.length} ACTIVE</span>
                      </div>

                      <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                        {radarData.slaItems.map((item) => (
                          <button
                            key={item.ticket_id}
                            onClick={() => handleSendMessage(`Check SLA status, governing contract, and resolve ticket ${item.ticket_id} (${item.account_name}).`)}
                            className="w-full text-left p-2.5 rounded-xl bg-[#0F0F0F] hover:bg-[#181818] border border-[#222222] hover:border-[#383838] transition group text-xs space-y-1"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bitcount text-[10px] font-bold text-white group-hover:text-amber-300 transition">
                                {item.ticket_id}
                              </span>
                              <span
                                className={`text-[9px] font-bitcount px-1.5 py-0.2 rounded font-bold ${
                                  item.status === 'BREACHED'
                                    ? 'bg-rose-950/60 text-rose-300 border border-rose-800/80'
                                    : 'bg-amber-950/60 text-amber-300 border border-amber-800/80'
                                }`}
                              >
                                {item.elapsed_minutes}m / {item.target_minutes}m
                              </span>
                            </div>
                            <div className="text-[11px] text-zinc-300 truncate">{item.subject}</div>
                            <div className="text-[9px] text-zinc-500 font-bitcount">{item.account_name} &bull; {item.account_id}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Active Spikes Quick Launcher */}
                    <div className="space-y-2 pt-2 border-t border-[#1C1C1C]">
                      <div className="text-[10px] font-bitcount font-bold text-zinc-500 uppercase tracking-wider">
                        ACTIVE TOPIC SPIKES
                      </div>

                      <div className="space-y-1.5">
                        {radarData.spikeClusters.map((cluster, cIdx) => (
                          <button
                            key={cIdx}
                            onClick={() => handleSendMessage(`What are the details and workarounds for ${cluster.topic}?`)}
                            className="w-full text-left p-2 rounded-xl bg-[#0F0F0F] hover:bg-[#181818] border border-[#222222] hover:border-[#383838] transition flex items-center justify-between text-xs group"
                          >
                            <div className="truncate mr-2">
                              <span className="text-zinc-200 group-hover:text-white font-medium block truncate text-[11px]">
                                {cluster.topic}
                              </span>
                              {cluster.ki_id && (
                                <span className="text-[9px] font-bitcount text-blue-400">Advisory: {cluster.ki_id}</span>
                              )}
                            </div>
                            <span className="text-[10px] font-bitcount text-amber-300 font-bold bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-900/60 shrink-0">
                              {cluster.count} tix
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Left Telemetry */}
              <div className="pt-3 border-t border-[#1C1C1C] flex items-center justify-between text-[9px] font-bitcount text-zinc-500">
                <span>{effectiveAccountId ? `SCOPED: ${effectiveAccountId}` : 'RADAR MONITOR: ACTIVE'}</span>
                <span className="text-emerald-400 font-bold">100 ACCOUNTS</span>
              </div>
            </div>
          )}

          {/* CENTER PANEL: Main Inquiry Transcript & Chat Feed */}
          <div
            className={`flex flex-col justify-between bg-[#080808] relative min-h-0 h-full overflow-hidden ${
              isInternal
                ? 'lg:col-span-8 xl:col-span-6'
                : 'lg:col-span-8 xl:col-span-8'
            }`}
          >
            {/* Transcript Header */}
            <div className="flex items-center justify-between px-4 sm:px-6 py-2.5 border-b border-[#1A1A1A] bg-[#0A0A0A] text-[9px] sm:text-[10px] font-bitcount text-zinc-500 font-bold uppercase tracking-wider shrink-0">
              <span>INQUIRY TRANSCRIPT &bull; SPEECH AUDIT</span>
              <span>{isInternal ? 'PARCELPILOT COPILOT' : 'SELF-SERVICE ASSISTANT'}</span>
            </div>

            {/* Conversation Feed */}
            <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4">
              {/* Role-Specific Escalation Queue Stream Banner */}
              {isInternal && (session as any).role === 'manager' && (
                <div className="p-3 rounded-xl bg-purple-950/40 border border-purple-800/60 flex items-center justify-between text-xs text-purple-200 font-google-sans shadow-sm">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1 rounded-lg bg-purple-900/60 text-purple-300">
                      <MaterialIcon name="verified_user" className="text-sm" />
                    </div>
                    <div>
                      <div className="font-bold text-white text-[11px]">Executive Escalations &amp; Approvals Stream</div>
                      <div className="text-[10px] text-purple-300">Showing only cases escalated to Manager &amp; high-value approvals</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-bitcount bg-purple-900/80 px-2.5 py-0.5 rounded-full border border-purple-600/70 font-bold text-purple-200">
                    MANAGER QUEUE ({messages.length})
                  </span>
                </div>
              )}

              {isInternal && (session as any).role === 'ops' && (
                <div className="p-3 rounded-xl bg-blue-950/40 border border-blue-800/60 flex items-center justify-between text-xs text-blue-200 font-google-sans shadow-sm">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1 rounded-lg bg-blue-900/60 text-blue-300">
                      <MaterialIcon name="engineering" className="text-sm" />
                    </div>
                    <div>
                      <div className="font-bold text-white text-[11px]">Tier-2 Operations Dispatch Stream</div>
                      <div className="text-[10px] text-blue-300">Showing only escalated operational incidents &amp; dispatch tasks</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-bitcount bg-blue-900/80 px-2.5 py-0.5 rounded-full border border-blue-600/70 font-bold text-blue-200">
                    OPS QUEUE ({messages.length})
                  </span>
                </div>
              )}

              {/* Handover Audit Chain for Internal Surfaces */}
              {isInternal && (
                <div className="mb-4 p-3 rounded-2xl bg-[#0D0D0D] border border-[#222222] text-xs">
                  <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-[#1A1A1A]">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                      <span className="font-bitcount text-[10px] font-bold text-blue-300 uppercase tracking-wider">
                        HANDOVER CHAIN &bull; CUSTOMER SELF-SERVICE AUDIT
                      </span>
                    </div>
                    <span className="text-[9px] font-mono text-zinc-500 bg-[#161616] px-2 py-0.5 rounded border border-[#2A2A2A]">
                      ORIGIN: {effectiveAccountId || 'ACCT-001 (NORTHSTAR)'}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex items-start gap-2 text-zinc-300">
                      <span className="font-bitcount text-[9px] text-zinc-500 shrink-0 w-16">02:22 PM</span>
                      <div>
                        <span className="font-semibold text-white">Customer: </span>
                        <span>&ldquo;My shipment was picked up by SwiftShip but still shows BOOKED. Why?&rdquo;</span>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 text-zinc-400">
                      <span className="font-bitcount text-[9px] text-zinc-500 shrink-0 w-16">02:23 PM</span>
                      <div>
                        <span className="font-semibold text-amber-300">Customer: </span>
                        <span>&ldquo;Its been 30 minutes since it was picked up &mdash; please escalate.&rdquo;</span>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 text-zinc-400">
                      <span className="font-bitcount text-[9px] text-zinc-500 shrink-0 w-16">03:41 PM</span>
                      <div>
                        <span className="font-semibold text-purple-300">Support Triage: </span>
                        <span>SLA Breached (22m elapsed vs 15m Northstar target). Case escalated to Ops &amp; Manager.</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {messages.length === 0 ? (
                <div className="py-12 sm:py-16 text-center px-4">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#141414] border border-[#242424] text-[10px] font-bitcount font-semibold text-zinc-400 tracking-wide mb-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-white" />
                    <span>SESSION READY</span>
                  </div>
                  <h3 className="text-base font-bold text-white mb-1">{title}</h3>
                  <p className="text-xs text-zinc-400 max-w-sm mx-auto mb-4">{subtitle}</p>
                  <p className="text-[11px] text-zinc-500">
                    Type an inquiry or click <span className="font-semibold text-zinc-300">&ldquo;Sample Queries&rdquo;</span> below.
                  </p>
                </div>
              ) : (
                messages.map((m) => (
                  <div key={m.id} className="flex items-start gap-2.5 sm:gap-3 text-xs">
                    {/* Timestamp */}
                    <span className="text-[10px] sm:text-[11px] font-bitcount text-zinc-500 shrink-0 mt-0.5 w-8 sm:w-10">
                      {m.timeLabel || '00:00'}
                    </span>

                    {/* Content Block */}
                    <div className="space-y-2 flex-1 min-w-0">
                      {/* Speaker Badge */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {(m as any).isActionConfirmation ? (
                          <span className="px-2 py-0.5 rounded font-bitcount text-[9px] font-bold uppercase bg-purple-950/80 text-purple-300 border border-purple-700/80 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                            SYSTEM EXECUTION &bull; LIVE AUDIT
                          </span>
                        ) : (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`px-2 py-0.5 rounded font-bitcount text-[9px] font-bold uppercase border ${
                                m.role === 'assistant'
                                  ? 'bg-[#151515] text-white border-[#303030]'
                                  : (m as any).role === 'staff'
                                  ? 'bg-[#161626] text-blue-300 border-[#2A2A44]'
                                  : 'bg-[#1E1E1E] text-zinc-300 border-[#333333]'
                              }`}
                            >
                              {m.speakerLabel || (m.role === 'assistant' ? (isInternal ? 'PARCELPILOT COPILOT' : 'PARCELPILOT AI') : 'CUSTOMER')}
                            </span>

                            {/* Small role badge aside copilot */}
                            {m.role === 'assistant' && isInternal && (
                              <span className="px-1.5 py-0.5 rounded font-bitcount text-[9px] font-bold uppercase bg-[#141420] text-blue-300 border border-blue-800/60">
                                {((session as any).role || 'SUPPORT').toUpperCase()}
                              </span>
                            )}
                          </div>
                        )}

                        {m.tool_traces && m.tool_traces.length > 0 && (
                          <div className="flex flex-wrap gap-1 items-center">
                            {m.tool_traces.map((trace, tIdx) => (
                              <ToolBadge key={tIdx} trace={trace} />
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Structured Message Box with Formatted Output */}
                      <div
                        className={`border p-4 rounded-2xl shadow-xs break-words ${
                          m.isSecurityAlert
                            ? 'bg-[#12080D] border-rose-900/50'
                            : m.isError
                            ? 'bg-[#150B0B] border-rose-900/50'
                            : 'bg-[#0F0F0F] border-[#1E1E1E]'
                        }`}
                      >
                        <FormattedMessage
                          content={
                            m.content.startsWith('/reply')
                              ? m.content.replace(/^\/reply\s*/i, '')
                              : m.content.startsWith('/r ')
                              ? m.content.replace(/^\/r\s*/i, '')
                              : m.content
                          }
                        />
                      </div>
                    </div>
                  </div>
                ))
              )}

              {loading && (
                <div className="flex items-start gap-2.5 text-xs">
                  <span className="text-[10px] font-bitcount text-zinc-500 shrink-0 mt-0.5 w-8">..:..</span>
                  <div className="flex items-center gap-2 text-zinc-400 bg-[#121212] p-3 rounded-2xl border border-[#242424] text-xs">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                    <span>Evaluating signed agreements, calculating fees, and citing sources...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Floating Suggested Queries Popup Menu */}
            {showPromptsMenu && suggestedPrompts.length > 0 && (
              <div
                ref={promptsMenuRef}
                className="absolute bottom-16 left-3 right-3 sm:right-auto sm:w-[440px] bg-[#121212] border border-[#262626] rounded-2xl p-3.5 sm:p-4 shadow-[0_15px_50px_rgba(0,0,0,0.8)] z-50 animate-in fade-in slide-in-from-bottom-2 duration-150 text-white"
              >
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#222222]">
                  <span className="text-[10px] font-bitcount font-bold text-zinc-400 uppercase tracking-wider">
                    SUGGESTED VERIFICATION QUERIES
                  </span>
                  <button
                    onClick={() => setShowPromptsMenu(false)}
                    className="p-1 rounded text-zinc-400 hover:text-white hover:bg-[#1E1E1E]"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-1 max-h-60 overflow-y-auto pr-1">
                  {suggestedPrompts.map((prompt, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(prompt)}
                      className="w-full text-left p-2 rounded-lg hover:bg-[#1A1A1A] border border-transparent hover:border-[#2E2E2E] text-zinc-300 hover:text-white text-xs transition flex items-start gap-2 group"
                    >
                      <span className="font-bitcount text-[10px] text-zinc-500 group-hover:text-white font-bold mt-0.5">
                        {idx + 1}.
                      </span>
                      <span className="flex-1 leading-snug">{prompt}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Floating Slash Commands Quick Palette */}
            {input.startsWith('/') && (
              <div className="absolute bottom-16 left-3 right-3 sm:right-auto sm:w-[380px] bg-[#121212] border border-[#2E2E2E] rounded-2xl p-3 shadow-[0_15px_50px_rgba(0,0,0,0.8)] z-50 animate-in fade-in slide-in-from-bottom-2 duration-150 text-white">
                <div className="text-[10px] font-bitcount font-bold text-zinc-400 uppercase tracking-wider pb-1.5 mb-1.5 border-b border-[#222222]">
                  AVAILABLE SLASH COMMANDS
                </div>
                <div className="space-y-1 text-xs font-mono">
                  <button
                    type="button"
                    onClick={() => setInput('/reply ')}
                    className="w-full text-left p-1.5 rounded-lg hover:bg-[#1C1C1C] flex items-center justify-between text-zinc-300 hover:text-white"
                  >
                    <span className="text-blue-400 font-bold">/reply [message]</span>
                    <span className="text-[10px] font-google-sans text-zinc-400">Direct message to client</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setInput('/escalate ')}
                    className="w-full text-left p-1.5 rounded-lg hover:bg-[#1C1C1C] flex items-center justify-between text-zinc-300 hover:text-white"
                  >
                    <span className="text-amber-400 font-bold">/escalate [reason]</span>
                    <span className="text-[10px] font-google-sans text-zinc-400">Page Ops / Manager</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setInput('/close')}
                    className="w-full text-left p-1.5 rounded-lg hover:bg-[#1C1C1C] flex items-center justify-between text-zinc-300 hover:text-white"
                  >
                    <span className="text-emerald-400 font-bold">/close</span>
                    <span className="text-[10px] font-google-sans text-zinc-400">Resolve &amp; close request</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setInput('/credit 2500')}
                    className="w-full text-left p-1.5 rounded-lg hover:bg-[#1C1C1C] flex items-center justify-between text-zinc-300 hover:text-white"
                  >
                    <span className="text-purple-400 font-bold">/credit [amount]</span>
                    <span className="text-[10px] font-google-sans text-zinc-400">Propose concession credit</span>
                  </button>
                </div>
              </div>
            )}

            {/* Input Bar */}
            <div className="p-3 border-t border-[#1F1F1F] bg-[#0A0A0A] shrink-0">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="flex gap-2 items-center"
              >
                {suggestedPrompts.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowPromptsMenu(!showPromptsMenu)}
                    className={`flex items-center gap-1 px-2.5 sm:px-3 py-2 rounded-xl border text-xs font-medium transition shrink-0 ${
                      showPromptsMenu
                        ? 'bg-white text-black border-white'
                        : 'bg-[#141414] hover:bg-[#1F1F1F] border-[#2A2A2A] text-zinc-300'
                    }`}
                    title="Toggle sample queries"
                  >
                    <span className="hidden sm:inline">Sample Queries</span>
                    <span className="sm:hidden text-[11px]">Queries</span>
                    {showPromptsMenu ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
                  </button>
                )}

                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (
                      (e.key === 'Enter' && !e.shiftKey) ||
                      (e.key === 'Enter' && (e.ctrlKey || e.metaKey))
                    ) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder={
                    effectiveAccountId
                      ? `Ask question for ${effectiveAccountId}... (or type / for commands)`
                      : 'Ask shipment question or execute action... (or type / for commands)'
                  }
                  disabled={loading}
                  className="flex-1 min-w-0 bg-[#141414] border border-[#262626] focus:border-white rounded-xl px-3 sm:px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none transition"
                />

                <button
                  type="submit"
                  disabled={loading || !input.trim()}
                  className="bg-white hover:bg-zinc-200 disabled:opacity-30 text-black px-3.5 sm:px-4 py-2 rounded-xl transition flex items-center gap-1.5 font-semibold text-xs shadow-sm shrink-0"
                >
                  <span className="hidden sm:inline">Send</span>
                  <MaterialIcon name="send" className="text-sm text-black" filled />
                </button>
              </form>
            </div>
          </div>

          {/* RIGHT PANEL: Live Deterministic Evaluation & Cited Sources */}
          <div
            className={`p-4 space-y-4 bg-[#0C0C0C] flex flex-col justify-between shrink-0 overflow-y-auto min-h-0 ${
              isInternal
                ? 'hidden xl:flex xl:col-span-3'
                : 'hidden lg:flex lg:col-span-4 xl:col-span-4'
            }`}
          >
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between text-[10px] font-bitcount text-zinc-400 font-bold uppercase tracking-wider pb-2 border-b border-[#222222]">
                <span className="flex items-center gap-1.5 text-white">
                  <span className="w-1.5 h-1.5 rounded-full bg-white" />
                  <span>DETERMINISTIC EVALUATION</span>
                </span>
                <span className="text-zinc-500">LIVE</span>
              </div>

              {/* 3 Metric Cards */}
              <div className="grid grid-cols-3 gap-2 text-xs font-bitcount">
                <div className="p-2.5 rounded-xl bg-[#141414] border border-[#242424] shadow-xs">
                  <div className="text-[8px] text-zinc-500 uppercase tracking-wider truncate">CANCELLATION</div>
                  <div className="text-xs font-bold text-white mt-0.5 truncate">{activeAnalysis.feeText}</div>
                  <div className="text-[9px] text-emerald-400 font-google-sans mt-0.5 truncate">{activeAnalysis.feeSub}</div>
                </div>

                <div className="p-2.5 rounded-xl bg-[#141414] border border-[#242424] shadow-xs">
                  <div className="text-[8px] text-zinc-500 uppercase tracking-wider truncate">CREDIT</div>
                  <div className="text-xs font-bold text-white mt-0.5 truncate">{activeAnalysis.creditText}</div>
                  <div className="text-[9px] text-blue-400 font-google-sans mt-0.5 truncate">{activeAnalysis.creditSub}</div>
                </div>

                <div className="p-2.5 rounded-xl bg-[#141414] border border-[#242424] shadow-xs">
                  <div className="text-[8px] text-zinc-500 uppercase tracking-wider truncate">SLA</div>
                  <div className="text-xs font-bold text-white mt-0.5 truncate">{activeAnalysis.slaText}</div>
                  <div className="text-[9px] text-purple-400 font-google-sans mt-0.5 truncate">{activeAnalysis.slaSub}</div>
                </div>
              </div>

              {/* Action Proposal Card */}
              {activeAnalysis.proposedAction && (
                <div className="animate-in fade-in duration-200">
                  <ConfirmationCard
                    proposal={activeAnalysis.proposedAction}
                    session={session}
                    onConfirmed={async () => {
                      await syncMessages();
                      const prop = activeAnalysis.proposedAction;
                      if (prop?.type === 'ticket_update') {
                        const closedId = prop.payload?.target_id || prop.payload?.ticket_id;
                        setAccountTickets((prev) => prev.filter((t) => t.ticket_id !== closedId));
                        setRadarData((prev) => ({
                          ...prev,
                          slaItems: prev.slaItems.filter((i) => i.ticket_id !== closedId),
                        }));
                      }
                    }}
                  />
                </div>
              )}

              {/* Authoritative Cited Source Cards */}
              <div className="space-y-2.5">
                <div className="text-[10px] font-bitcount font-bold text-zinc-500 uppercase tracking-wider">
                  ● CITATIONS ({activeAnalysis.sources.length > 0 ? activeAnalysis.sources.length : '1 ACTIVE'})
                </div>

                {activeAnalysis.sources.length === 0 ? (
                  <div className="p-3 rounded-xl bg-[#141414] border border-[#242424] shadow-xs space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-bitcount font-bold">
                      <span className="text-white uppercase flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        <span>AUTHORITY &bull; RULE 9</span>
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-[#1F1F1F] text-zinc-400 border border-[#303030] flex items-center gap-1">
                        <FileCode className="w-3 h-3 text-zinc-500" />
                        <span>DOC-POLICY &bull; p.1</span>
                      </span>
                    </div>
                    <p className="text-xs text-zinc-300 leading-relaxed font-serif pt-1 italic">
                      &ldquo;Signed Customer Agreement (Rank 1) takes absolute precedence over Support Policy v3 and SOP v4.&rdquo;
                    </p>
                  </div>
                ) : (
                  activeAnalysis.sources.slice(0, 3).map((s, idx) => (
                    <div key={idx} className="p-3 rounded-xl bg-[#141414] border border-[#242424] shadow-xs space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-bitcount font-bold">
                        <span className="text-white uppercase flex items-center gap-1.5 truncate mr-2">
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              s.authority_rank === 1 ? 'bg-amber-400' : 'bg-blue-400'
                            }`}
                          />
                          <span className="truncate">{s.title || s.doc_id}</span>
                        </span>
                        {s.authority_rank && (
                          <span className="px-1.5 py-0.5 rounded bg-[#1F1F1F] text-zinc-400 border border-[#303030] flex items-center gap-1 shrink-0 font-bitcount text-[9px]">
                            <FileCode className="w-3 h-3 text-zinc-500" />
                            <span>RANK {s.authority_rank}</span>
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-300 leading-relaxed font-serif pt-0.5 italic">
                        &ldquo;{s.text}&rdquo;
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Bottom Telemetry Status */}
            <div className="pt-4 border-t border-[#1F1F1F] text-[9px] font-bitcount text-zinc-500 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
                <span className="ml-1">DETERMINISTIC ENGINE</span>
              </span>
              <span className="text-zinc-400 font-bold">CALQUITY</span>
            </div>
          </div>

        </div>
      </div>

      {/* Interactive Close Request Confirmation Modal */}
      {showCloseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-[#111111] border border-[#2A2A2A] rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-2.5 rounded-full bg-rose-950/60 border border-rose-800/80 shrink-0">
                <MaterialIcon name="warning" className="text-xl text-rose-400" filled />
              </div>
              <div>
                <h3 className="font-bold text-sm text-white font-bitcount">CONFIRM CLOSE REQUEST</h3>
                <p className="text-xs text-zinc-400 font-google-sans">Resolve and archive active inquiry from the system.</p>
              </div>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed bg-[#171717] p-3 rounded-xl border border-[#262626]">
              Are you sure you want to close this request for <strong className="text-white">{effectiveAccountId || 'Current Tenant'}</strong>? This will remove the incident from the active SLA radar and write a final resolution audit log.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setShowCloseModal(false)}
                className="px-4 py-1.5 rounded-full text-xs text-zinc-400 hover:text-white bg-[#1C1C1C] hover:bg-[#252525] border border-[#333333] transition font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowCloseModal(false);
                  const targetTkt = effectiveTicketId || 'TKT-501';
                  handleSendMessage(`/close ${targetTkt}`);
                  setAccountTickets((prev) => prev.filter((t) => t.ticket_id !== targetTkt && (!effectiveAccountId || t.account_id !== effectiveAccountId)));
                  setRadarData((prev) => ({
                    ...prev,
                    slaItems: prev.slaItems.filter((i) => i.ticket_id !== targetTkt && (!effectiveAccountId || i.account_id !== effectiveAccountId)),
                  }));
                  if (onTicketClosed) onTicketClosed(targetTkt);
                }}
                className="px-4 py-1.5 rounded-full text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 shadow-md shadow-rose-950/50 transition flex items-center gap-1.5"
              >
                <MaterialIcon name="check_circle" className="text-sm text-white" filled />
                <span>Confirm & Close</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
