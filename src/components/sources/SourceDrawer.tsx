'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

export function SourceDrawer({ sources }: { sources: any[] }) {
  const [open, setOpen] = useState(false);

  if (!sources || sources.length === 0) return null;

  return (
    <div className="mt-3 pt-2.5 border-t border-[#222222] text-xs font-google-sans">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full text-[10px] font-bitcount font-bold text-zinc-400 hover:text-white uppercase tracking-wider py-1 transition"
      >
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-white" />
          <span>SOURCES • {sources.length} AUTHORITATIVE CITATIONS</span>
        </span>
        <span className="flex items-center gap-1 text-zinc-500 font-mono text-[9px]">
          {open ? 'HIDE' : 'EXPAND'}
          {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </span>
      </button>

      {open && (
        <div className="space-y-2 mt-2 pt-1 animate-in fade-in duration-150">
          {sources.map((s, idx) => (
            <div
              key={idx}
              className="p-3 rounded-xl bg-[#0F0F0F] border border-[#262626] text-xs text-zinc-300 shadow-xs"
            >
              <div className="flex items-center justify-between gap-2 mb-1.5 font-bitcount text-[10px]">
                <div className="flex items-center gap-1.5 text-white font-bold truncate">
                  <span className="text-zinc-400">[{idx + 1}]</span>
                  <span>{s.title || s.doc_id}</span>
                  {s.section && <span className="text-zinc-500 font-normal">• {s.section}</span>}
                </div>
                {s.authority_rank && (
                  <span className="px-1.5 py-0.5 rounded bg-[#1C1C1C] border border-[#333333] text-[9px] text-zinc-400 font-mono shrink-0">
                    RANK {s.authority_rank}
                  </span>
                )}
              </div>

              <p className="text-[11px] text-zinc-400 leading-relaxed font-serif pl-2 border-l border-zinc-700 italic">
                &ldquo;{s.text}&rdquo;
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
