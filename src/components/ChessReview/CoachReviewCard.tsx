'use client';

import React from 'react';
import type { MoveAnalysis, GameReviewReport, MoveClassification } from '../../types/review';
import { generateMoveCommentary } from '../../lib/coachReviewer';

const CLASS_BADGE_STYLES: Record<MoveClassification, { bg: string; text: string; label: string }> = {
  brilliant: { bg: 'bg-teal-500/20 border-teal-500/40', text: 'text-teal-300', label: 'Brilliant !!' },
  great: { bg: 'bg-blue-500/20 border-blue-500/40', text: 'text-blue-300', label: 'Great !' },
  best: { bg: 'bg-green-500/20 border-green-500/40', text: 'text-green-300', label: 'Best ★' },
  excellent: { bg: 'bg-green-500/15 border-green-500/30', text: 'text-green-400', label: 'Excellent ✓' },
  good: { bg: 'bg-gray-500/20 border-gray-500/30', text: 'text-gray-300', label: 'Good' },
  book: { bg: 'bg-amber-800/20 border-amber-800/40', text: 'text-amber-500', label: 'Book 📖' },
  inaccuracy: { bg: 'bg-yellow-500/20 border-yellow-500/40', text: 'text-yellow-300', label: 'Inaccuracy ?!' },
  mistake: { bg: 'bg-orange-500/20 border-orange-500/40', text: 'text-orange-300', label: 'Mistake ?' },
  miss: { bg: 'bg-orange-600/20 border-orange-600/40', text: 'text-orange-400', label: 'Miss ??' },
  blunder: { bg: 'bg-red-500/20 border-red-500/40', text: 'text-red-300', label: 'Blunder ??' },
};

interface CoachReviewCardProps {
  move: MoveAnalysis | null;
  report: GameReviewReport;
}

export const CoachReviewCard: React.FC<CoachReviewCardProps> = ({ move, report }) => {
  if (!move) {
    return (
      <div className="bg-[#181a20] rounded-xl border border-gray-800 p-4 shadow-sm">
        <div className="flex items-center gap-2.5 mb-2.5">
          <span className="text-2xl">🎓</span>
          <span className="text-sm font-bold text-gray-200">Coach Game Review</span>
        </div>
        <p className="text-gray-400 text-xs leading-relaxed">
          Navigate through moves or click on the advantage chart to see coach tactical commentary, evaluation swings, and key turning points.
        </p>
      </div>
    );
  }

  const badge = CLASS_BADGE_STYLES[move.classification];
  const commentary = generateMoveCommentary(move, report);
  const playerName = move.color === 'w' ? report.whitePlayer : report.blackPlayer;
  const evalDisplay = move.evalAfter / 100;

  return (
    <div className="bg-[#181a20] rounded-xl border border-gray-800 p-4 space-y-3 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🎓</span>
          <span className="text-sm font-bold text-gray-200">Coach Commentary</span>
        </div>
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${badge.bg} ${badge.text}`}>
          {badge.label}
        </span>
      </div>

      {/* Move Info */}
      <div className="flex items-center gap-2.5 bg-[#14161a] p-2.5 rounded-lg border border-gray-800/80">
        <div
          className={`w-6 h-6 rounded-full border flex items-center justify-center text-xs font-black
            ${move.color === 'w' ? 'bg-white text-black border-gray-300' : 'bg-gray-800 text-white border-gray-600'}
          `}
        >
          {move.color === 'w' ? 'W' : 'B'}
        </div>
        <div className="flex-1">
          <span className="text-white font-bold font-mono text-base">{move.moveNumber}{move.color === 'w' ? '.' : '...'} {move.san}</span>
          <span className="text-gray-400 text-xs ml-2">by {playerName}</span>
        </div>
      </div>

      {/* Coach Feedback Note */}
      <div className="bg-[#131519] rounded-lg p-3 border border-gray-800/60">
        <p className="text-gray-200 text-xs leading-relaxed">{commentary}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-[#14161a] rounded-lg p-2 border border-gray-800/50">
          <div className="text-[10px] text-gray-400 font-medium">Evaluation</div>
          <div className={`text-xs font-black font-mono ${evalDisplay >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {evalDisplay >= 0 ? '+' : ''}{evalDisplay.toFixed(2)}
          </div>
        </div>
        <div className="bg-[#14161a] rounded-lg p-2 border border-gray-800/50">
          <div className="text-[10px] text-gray-400 font-medium">Win Chance</div>
          <div className="text-xs font-black text-blue-400 font-mono">
            {move.winProbAfter.toFixed(1)}%
          </div>
        </div>
        <div className="bg-[#14161a] rounded-lg p-2 border border-gray-800/50">
          <div className="text-[10px] text-gray-400 font-medium">WP Swing</div>
          <div className={`text-xs font-black font-mono ${move.winProbLoss > 3 ? 'text-red-400' : move.winProbLoss > 0.5 ? 'text-yellow-400' : 'text-green-400'}`}>
            {move.winProbLoss > 0 ? '-' : '+'}{Math.abs(move.winProbLoss).toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Clock Time */}
      {move.clockTime && (
        <div className="flex items-center gap-1.5 text-[11px] text-gray-400 font-mono">
          <span>⏱️ Remaining: {move.clockTime}</span>
          {move.secondsSpent !== undefined && (
            <span className="text-gray-500">({move.secondsSpent}s spent)</span>
          )}
        </div>
      )}

      {/* Key Moment Banner */}
      {move.isKeyMoment && (
        <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs px-2.5 py-1.5 rounded-lg font-medium">
          <span>🔑</span>
          <span>Critical Turning Point in the game</span>
        </div>
      )}
    </div>
  );
};
