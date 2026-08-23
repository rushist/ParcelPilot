import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { MaterialIcon } from '../ui/MaterialIcon';
import { ProposedActionResponse } from '@/actions/propose';
import { SessionContext } from '@/types';

export function ConfirmationCard({
  proposal,
  session,
  onConfirmed,
}: {
  proposal: ProposedActionResponse;
  session: SessionContext;
  onConfirmed?: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'pending' | 'confirmed' | 'error'>('pending');
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/action/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action_id: proposal.action_id,
          session,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setStatus('error');
        setResultMessage(data.error || 'Failed to execute action.');
      } else {
        setStatus('confirmed');
        setResultMessage(data.message || 'Action executed successfully.');
        if (onConfirmed) onConfirmed();
      }
    } catch (err: any) {
      setStatus('error');
      setResultMessage(err.message || 'Network error confirming action.');
    } finally {
      setLoading(false);
    }
  };

  const financialImpact = proposal.payload?.fee_inr !== undefined
    ? `INR ${proposal.payload.fee_inr}`
    : proposal.payload?.amount_inr !== undefined
    ? `INR ${proposal.payload.amount_inr}`
    : null;

  return (
    <div className="my-3 p-4 rounded-2xl border border-[#2B2B2B] bg-[#0E0E0E] text-white shadow-md text-xs font-google-sans">
      <div className="flex items-center justify-between gap-2 mb-3 pb-2 border-b border-[#222222]">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-amber-400" />
          <span className="font-bitcount text-[11px] font-bold tracking-wider text-amber-300 uppercase">
            {session.surface === 'customer' && proposal.type === 'escalation'
              ? 'PRIORITY SUPPORT HANDOFF'
              : 'ACTION CONFIRMATION REQUIRED'}
          </span>
        </div>
        <span className="font-mono text-[9px] text-zinc-500 bg-[#1A1A1A] px-2 py-0.5 rounded border border-[#303030]">
          ID: {proposal.action_id}
        </span>
      </div>

      <div className="space-y-2 mb-4 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-zinc-500 font-mono text-[10px] w-20">TYPE:</span>
          <span className="font-bold text-white uppercase font-mono">{proposal.type}</span>
        </div>

        <div className="flex items-start gap-2">
          <span className="text-zinc-500 font-mono text-[10px] w-20 shrink-0 mt-0.5">SUMMARY:</span>
          <span className="text-zinc-200 leading-snug">{proposal.summary}</span>
        </div>

        {financialImpact && (
          <div className="flex items-center gap-2">
            <span className="text-zinc-500 font-mono text-[10px] w-20">IMPACT:</span>
            <span className="text-amber-200 font-mono text-[11px] font-semibold">
              {financialImpact}
            </span>
          </div>
        )}

        {proposal.requires_manager_approval && (
          <div className="p-2.5 rounded-xl bg-purple-950/40 border border-purple-800/60 text-purple-200 text-[11px] flex items-center gap-2">
            <MaterialIcon name="warning" className="text-sm text-purple-400 shrink-0" filled />
            <span>High-value action (&gt;INR 1,000). Requires Manager role to confirm.</span>
          </div>
        )}
      </div>

      {status === 'pending' && (
        <div className="flex items-center gap-2.5 pt-1">
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="flex-1 py-2.5 px-3 rounded-xl bg-white hover:bg-zinc-200 text-black font-semibold text-xs transition flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-black" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <MaterialIcon name="check_circle" className="text-sm text-black" filled />
                <span>
                  {session.surface === 'customer'
                    ? proposal.type === 'escalation'
                      ? 'Connect with Live Specialist'
                      : proposal.type === 'cancellation'
                      ? 'Confirm Order Cancellation'
                      : 'Confirm Action'
                    : proposal.type === 'escalation'
                    ? 'Page Tier-2 Dispatch Operations'
                    : proposal.type === 'service_credit'
                    ? 'Authorize & Issue Credit'
                    : proposal.type === 'cancellation'
                    ? 'Confirm Shipment Cancellation'
                    : proposal.type === 'ticket_update'
                    ? 'Persist Operational Note'
                    : 'Confirm & Execute Action'}
                </span>
              </>
            )}
          </button>
        </div>
      )}

      {status === 'confirmed' && (
        <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-xs flex items-center gap-2">
          <MaterialIcon name="check_circle" className="text-sm text-emerald-400 shrink-0" filled />
          <span className="font-medium">{resultMessage}</span>
        </div>
      )}

      {status === 'error' && (
        <div className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-center gap-2">
          <MaterialIcon name="cancel" className="text-sm text-rose-400 shrink-0" filled />
          <span className="font-medium">{resultMessage}</span>
        </div>
      )}
    </div>
  );
}
