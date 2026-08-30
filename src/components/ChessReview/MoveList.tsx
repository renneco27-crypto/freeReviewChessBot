'use client';

import React from 'react';
import type { MoveAnalysis, MoveClassification } from '../../types/review';

const CLASSIFICATION_SYMBOLS: Record<MoveClassification, { icon: string; color: string; label: string }> = {
  brilliant: { icon: '💎', color: '#26c2a3', label: 'Brilliant' },
  great: { icon: '!', color: '#5b8bb6', label: 'Great' },
  best: { icon: '★', color: '#81b64c', label: 'Best' },
  excellent: { icon: '✓', color: '#81b64c', label: 'Excellent' },
  good: { icon: '·', color: '#97af8b', label: 'Good' },
  book: { icon: '📖', color: '#a88865', label: 'Book' },
  inaccuracy: { icon: '?!', color: '#f7c631', label: 'Inaccuracy' },
  mistake: { icon: '?', color: '#e58f2a', label: 'Mistake' },
  miss: { icon: '??', color: '#e56c2a', label: 'Miss' },
  blunder: { icon: '??', color: '#ca3431', label: 'Blunder' },
};

interface MoveListProps {
  moves: MoveAnalysis[];
  currentPly: number;
  onMoveSelect: (ply: number) => void;
}

export const MoveList: React.FC<MoveListProps> = ({ moves, currentPly, onMoveSelect }) => {
  const movePairs: { number: number; white?: MoveAnalysis; black?: MoveAnalysis }[] = [];
  for (const move of moves) {
    if (move.color === 'w') {
      movePairs.push({ number: move.moveNumber, white: move });
    } else {
      const lastPair = movePairs[movePairs.length - 1];
      if (lastPair && lastPair.number === move.moveNumber) {
        lastPair.black = move;
      } else {
        movePairs.push({ number: move.moveNumber, black: move });
      }
    }
  }

  const renderMove = (move: MoveAnalysis | undefined) => {
    if (!move) return <div className="w-[46%]" />;

    const sym = CLASSIFICATION_SYMBOLS[move.classification];
    const isActive = move.ply === currentPly;

    return (
      <button
        onClick={() => onMoveSelect(move.ply)}
        className={`w-[46%] flex items-center justify-between px-2 py-1 rounded text-sm font-mono transition-all
          ${isActive
            ? 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/60 font-bold shadow-sm'
            : 'hover:bg-white/5 text-gray-300'
          }
        `}
      >
        <div className="flex items-center gap-1.5 truncate">
          <span style={{ color: sym.color }} className="text-xs font-black min-w-[14px]">
            {sym.icon}
          </span>
          <span className={move.isKeyMoment ? 'text-amber-200 font-bold' : ''}>{move.san}</span>
        </div>
        {move.clockTime && (
          <span className="text-[10px] text-gray-500 font-sans">{move.clockTime}</span>
        )}
      </button>
    );
  };

  return (
    <div className="bg-[#181a20] rounded-xl border border-gray-800 overflow-hidden flex flex-col h-[320px] shadow-sm">
      <div className="px-3.5 py-2.5 border-b border-gray-800 flex items-center justify-between bg-[#14161a]">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-gray-200">Move List</span>
          <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">{moves.length} ply</span>
        </div>
        <span className="text-[11px] text-gray-500">Click or use ← → keys</span>
      </div>
      <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
        {movePairs.map((pair) => (
          <div
            key={pair.number}
            className="flex items-center gap-1 py-0.5 px-1 rounded hover:bg-gray-800/40"
          >
            <span className="text-gray-500 text-xs font-mono w-6 text-right shrink-0">
              {pair.number}.
            </span>
            {renderMove(pair.white)}
            {renderMove(pair.black)}
          </div>
        ))}
      </div>
    </div>
  );
};
