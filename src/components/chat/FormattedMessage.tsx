'use client';

import React from 'react';
import { FileText, Bookmark } from 'lucide-react';

interface FormattedMessageProps {
  content: string;
}

export function FormattedMessage({ content }: FormattedMessageProps) {
  if (!content) return null;

  // Split into lines to parse paragraphs, lists, headers, bullet points, and source citations
  const lines = content.split('\n');

  const renderLineWithEntities = (text: string) => {
    // Replace **bold** and *italic* markers
    const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g);

    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        const inner = part.slice(2, -2);
        return (
          <strong key={index} className="font-bold text-white tracking-wide">
            {inner}
          </strong>
        );
      }
      if (part.startsWith('*') && part.endsWith('*') && !part.startsWith('**')) {
        const inner = part.slice(1, -1);
        return (
          <em key={index} className="italic text-zinc-300">
            {inner}
          </em>
        );
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        const inner = part.slice(1, -1);
        return (
          <code
            key={index}
            className="px-1.5 py-0.5 mx-0.5 rounded bg-[#1C1C1C] border border-[#2E2E2E] text-zinc-300 font-mono text-[11px]"
          >
            {inner}
          </code>
        );
      }

      // Detect entities like ORD-1001, ACCT-001, TKT-501, KI-208, ₹xxx, P1 Critical
      const words = part.split(/(ORD-\d+|ACCT-\d+|TKT-\d+|KI-\d+|₹\d+|INR\s*\d+|P1\s*Critical|P1|P2|P3|P4)/gi);

      return (
        <span key={index}>
          {words.map((word, wIdx) => {
            if (/^ORD-\d+/i.test(word) || /^ACCT-\d+/i.test(word) || /^TKT-\d+/i.test(word)) {
              return (
                <span
                  key={wIdx}
                  className="px-1.5 py-0.2 rounded bg-[#181818] border border-[#2E2E2E] text-white font-bitcount text-[10px] font-semibold inline-block mx-0.5 shadow-2xs"
                >
                  {word}
                </span>
              );
            }
            if (/^KI-\d+/i.test(word)) {
              return (
                <span
                  key={wIdx}
                  className="px-1.5 py-0.2 rounded bg-blue-950/60 border border-blue-800/80 text-blue-300 font-bitcount text-[10px] font-semibold inline-block mx-0.5 shadow-2xs"
                >
                  {word}
                </span>
              );
            }
            if (/^(₹\d+|INR\s*\d+)/i.test(word)) {
              return (
                <span
                  key={wIdx}
                  className="px-1.5 py-0.2 rounded bg-amber-950/50 border border-amber-800/70 text-amber-300 font-bitcount text-[11px] font-bold inline-block mx-0.5 shadow-2xs"
                >
                  {word}
                </span>
              );
            }
            if (/^P1(\s*Critical)?/i.test(word)) {
              return (
                <span
                  key={wIdx}
                  className="px-1.5 py-0.2 rounded bg-purple-950/60 border border-purple-800/80 text-purple-300 font-bitcount text-[10px] font-bold inline-block mx-0.5"
                >
                  {word}
                </span>
              );
            }
            return word;
          })}
        </span>
      );
    });
  };

  return (
    <div className="space-y-2.5 text-xs leading-relaxed text-zinc-200 font-google-sans">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <div key={idx} className="h-1" />;
        }

        // Dedicated Source citation line (e.g. *Source: ...* or Source: ...)
        const isSourceLine =
          trimmed.toLowerCase().startsWith('*source:') ||
          trimmed.toLowerCase().startsWith('source:') ||
          trimmed.toLowerCase().startsWith('*sources:') ||
          trimmed.toLowerCase().startsWith('sources:');

        if (isSourceLine) {
          const cleanSourceText = trimmed
            .replace(/^\*+/, '')
            .replace(/\*+$/, '')
            .replace(/^source(s)?:\s*/i, '');

          return (
            <div key={idx} className="mt-3 pt-2.5 border-t border-[#242424] animate-in fade-in duration-150">
              <div className="p-2.5 rounded-xl bg-[#141414] border border-[#282828] text-[11px] text-zinc-300 shadow-2xs flex items-start gap-2">
                <Bookmark className="w-3.5 h-3.5 text-zinc-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <span className="font-bitcount text-[9px] font-bold text-zinc-400 uppercase tracking-wider block mb-0.5">
                    AUTHORITATIVE SOURCE CITATION
                  </span>
                  <div className="text-zinc-200 font-serif leading-snug">
                    {renderLineWithEntities(cleanSourceText)}
                  </div>
                </div>
              </div>
            </div>
          );
        }

        // Section header: ### Header or **Title:**
        if (trimmed.startsWith('###') || (trimmed.startsWith('**') && trimmed.endsWith('**') && !trimmed.includes(': '))) {
          const title = trimmed.replace(/^###\s*/, '').replace(/^\*\*/, '').replace(/\*\*$/, '');
          return (
            <div key={idx} className="pt-2 pb-1 text-[13px] font-bold text-white font-google-sans tracking-tight border-b border-[#1F1F1F] flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-white" />
              <span>{title}</span>
            </div>
          );
        }

        // Numbered list item: 1. Item or 1) Item
        const numMatch = trimmed.match(/^(\d+)[\.\)]\s+(.*)$/);
        if (numMatch) {
          return (
            <div key={idx} className="flex items-start gap-2.5 pl-1.5 py-0.5">
              <span className="font-bitcount text-[10px] text-zinc-400 bg-[#161616] border border-[#282828] w-5 h-5 rounded-full flex items-center justify-center shrink-0 font-bold mt-0.5 shadow-2xs">
                {numMatch[1]}
              </span>
              <div className="flex-1 leading-snug text-zinc-200">
                {renderLineWithEntities(numMatch[2])}
              </div>
            </div>
          );
        }

        // Bullet list item: - Item or * Item or • Item
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('• ')) {
          const itemText = trimmed.replace(/^[-*•]\s+/, '');
          return (
            <div key={idx} className="flex items-start gap-2.5 pl-2 py-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0 mt-1.5 shadow-xs" />
              <div className="flex-1 leading-snug text-zinc-200">
                {renderLineWithEntities(itemText)}
              </div>
            </div>
          );
        }

        // Normal paragraph
        return (
          <p key={idx} className="leading-relaxed text-zinc-200">
            {renderLineWithEntities(trimmed)}
          </p>
        );
      })}
    </div>
  );
}
