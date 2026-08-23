'use client';

import React from 'react';
import { Database, Search, Calculator, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { ToolExecutionTrace } from '@/agent/tools/data-tools';

export function ToolBadge({ trace }: { trace: ToolExecutionTrace }) {
  const getIcon = () => {
    switch (trace.tool) {
      case 'get_order':
      case 'get_account':
      case 'get_ticket':
      case 'get_orders':
      case 'get_tickets':
        return <Database className="w-3 h-3 text-zinc-300" />;
      case 'search_documents':
        return <Search className="w-3 h-3 text-zinc-300" />;
      case 'calc_cancellation_fee':
      case 'calc_service_credit':
      case 'check_sla_status':
        return <Calculator className="w-3 h-3 text-zinc-300" />;
      case 'propose_action':
      case 'confirm_action':
        return <ShieldCheck className="w-3 h-3 text-zinc-300" />;
      default:
        return <CheckCircle2 className="w-3 h-3 text-zinc-300" />;
    }
  };

  const formatArgs = (args: any) => {
    try {
      if (!args) return '';
      const keys = Object.keys(args);
      if (keys.length === 0) return '';
      return keys.map((k) => `${k}: ${args[k]}`).join(', ');
    } catch {
      return '';
    }
  };

  return (
    <div
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#161616] border border-[#282828] text-[10px] font-bitcount text-zinc-300 mr-1.5 mb-1 shadow-2xs"
      title={formatArgs(trace.inputs)}
    >
      {getIcon()}
      <span className="font-medium text-white">{trace.tool}</span>
      <span className="text-zinc-500 font-mono text-[9px]">{trace.durationMs}ms</span>
    </div>
  );
}
