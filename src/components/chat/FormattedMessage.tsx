'use client';

import React from 'react';
import { Bookmark, Info, CheckCircle2 } from 'lucide-react';

interface FormattedMessageProps {
  content: string;
  onQuickAction?: (actionText: string) => void;
}

export function FormattedMessage({ content, onQuickAction }: FormattedMessageProps) {
  if (!content) return null;

  // Split into lines to parse paragraphs, lists, headers, bullet points, tables, blockquotes and source citations
  const rawLines = content.split('\n');

  const renderTextWithEntities = (text: string) => {
    // Replace **bold** and *italic* and `code` markers
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
      const words = part.split(/(ORD-\d+|ACCT-\d+|TKT-\d+|KI-\d+|₹\d+|INR\s*[\d,]+|P1\s*Critical|P1|P2|P3|P4)/gi);

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
            if (/^(₹\d+|INR\s*[\d,]+)/i.test(word)) {
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

  // Group table lines together into table blocks
  const blocks: Array<
    | { type: 'table'; rows: string[][] }
    | { type: 'quote'; text: string }
    | { type: 'source'; text: string }
    | { type: 'header'; text: string }
    | { type: 'numbered'; num: string; text: string }
    | { type: 'bullet'; text: string }
    | { type: 'paragraph'; text: string }
    | { type: 'space' }
  > = [];

  let currentTableRows: string[][] | null = null;

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i].trim();

    if (!line) {
      if (currentTableRows) {
        blocks.push({ type: 'table', rows: currentTableRows });
        currentTableRows = null;
      }
      blocks.push({ type: 'space' });
      continue;
    }

    // Table row detection
    if (line.startsWith('|') && line.endsWith('|')) {
      const cells = line
        .slice(1, -1)
        .split('|')
        .map((c) => c.trim());

      // Check if divider row (e.g. | :--- | :--- |)
      const isDivider = cells.every((c) => /^:?-+:?$/.test(c));
      if (!isDivider) {
        if (!currentTableRows) currentTableRows = [];
        currentTableRows.push(cells);
      }
      continue;
    } else if (currentTableRows) {
      blocks.push({ type: 'table', rows: currentTableRows });
      currentTableRows = null;
    }

    // Dedicated Source citation line
    const isSourceLine =
      line.toLowerCase().startsWith('*source:') ||
      line.toLowerCase().startsWith('source:') ||
      line.toLowerCase().startsWith('*sources:') ||
      line.toLowerCase().startsWith('sources:');

    if (isSourceLine) {
      const cleanSourceText = line
        .replace(/^\*+/, '')
        .replace(/\*+$/, '')
        .replace(/^source(s)?:\s*/i, '');
      blocks.push({ type: 'source', text: cleanSourceText });
      continue;
    }

    // Blockquote
    if (line.startsWith('>')) {
      blocks.push({ type: 'quote', text: line.replace(/^>\s*/, '') });
      continue;
    }

    // Header
    if (line.startsWith('###') || (line.startsWith('**') && line.endsWith('**') && !line.includes(': ') && line.length < 50)) {
      const title = line.replace(/^###\s*/, '').replace(/^\*\*/, '').replace(/\*\*$/, '');
      blocks.push({ type: 'header', text: title });
      continue;
    }

    // Numbered list item
    const numMatch = line.match(/^(\d+)[\.\)]\s+(.*)$/);
    if (numMatch) {
      blocks.push({ type: 'numbered', num: numMatch[1], text: numMatch[2] });
      continue;
    }

    // Bullet list item
    if (line.startsWith('- ') || line.startsWith('* ') || line.startsWith('• ')) {
      blocks.push({ type: 'bullet', text: line.replace(/^[-*•]\s+/, '') });
      continue;
    }

    // Standard paragraph
    blocks.push({ type: 'paragraph', text: line });
  }

  if (currentTableRows) {
    blocks.push({ type: 'table', rows: currentTableRows });
  }

  return (
    <div className="space-y-2.5 text-xs leading-relaxed text-zinc-200 font-google-sans">
      {blocks.map((block, idx) => {
        if (block.type === 'space') {
          return <div key={idx} className="h-1" />;
        }

        if (block.type === 'table') {
          const [headers, ...rows] = block.rows;
          return (
            <div key={idx} className="my-2.5 overflow-x-auto rounded-xl border border-[#222222] bg-[#0E0E0E] shadow-sm">
              <table className="w-full text-left text-xs border-collapse">
                {headers && (
                  <thead>
                    <tr className="border-b border-[#222222] bg-[#141414] text-[10px] font-bitcount font-bold text-zinc-300 uppercase tracking-wider">
                      {headers.map((h, hIdx) => (
                        <th key={hIdx} className="px-3 py-2">
                          {renderTextWithEntities(h)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                )}
                <tbody className="divide-y divide-[#1C1C1C]">
                  {rows.map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-[#161616] transition">
                      {row.map((cell, cIdx) => (
                        <td key={cIdx} className="px-3 py-2 text-zinc-300">
                          {renderTextWithEntities(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        if (block.type === 'quote') {
          return (
            <div key={idx} className="my-2 p-3 rounded-xl bg-[#141414] border-l-2 border-amber-400 border-t border-r border-b border-[#222222] text-xs text-zinc-300 italic shadow-xs">
              {renderTextWithEntities(block.text)}
            </div>
          );
        }

        if (block.type === 'source') {
          return (
            <div key={idx} className="mt-3 pt-2.5 border-t border-[#242424] animate-in fade-in duration-150">
              <div className="p-2.5 rounded-xl bg-[#141414] border border-[#282828] text-[11px] text-zinc-300 shadow-2xs flex items-start gap-2">
                <Bookmark className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <span className="font-bitcount text-[9px] font-bold text-amber-400 uppercase tracking-wider block mb-0.5">
                    AUTHORITATIVE SOURCE CITATION
                  </span>
                  <div className="text-zinc-200 font-serif leading-snug">
                    {renderTextWithEntities(block.text)}
                  </div>
                </div>
              </div>
            </div>
          );
        }

        if (block.type === 'header') {
          return (
            <div key={idx} className="pt-2 pb-1 text-[13px] font-bold text-white font-google-sans tracking-tight border-b border-[#1F1F1F] flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              <span>{block.text}</span>
            </div>
          );
        }

        if (block.type === 'numbered') {
          return (
            <div key={idx} className="flex items-start gap-2.5 pl-1.5 py-0.5">
              <span className="font-bitcount text-[10px] text-amber-300 bg-amber-950/40 border border-amber-800/60 w-5 h-5 rounded-full flex items-center justify-center shrink-0 font-bold mt-0.5 shadow-2xs">
                {block.num}
              </span>
              <div className="flex-1 leading-snug text-zinc-200">
                {renderTextWithEntities(block.text)}
              </div>
            </div>
          );
        }

        if (block.type === 'bullet') {
          return (
            <div key={idx} className="flex items-start gap-2.5 pl-2 py-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0 mt-1.5 shadow-xs" />
              <div className="flex-1 leading-snug text-zinc-200">
                {renderTextWithEntities(block.text)}
              </div>
            </div>
          );
        }

        return (
          <p key={idx} className="leading-relaxed text-zinc-200">
            {renderTextWithEntities(block.text)}
          </p>
        );
      })}
    </div>
  );
}
