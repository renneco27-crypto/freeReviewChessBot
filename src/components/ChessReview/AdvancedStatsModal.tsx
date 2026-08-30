'use client';

import React from 'react';
import type { GameReviewReport, MoveClassification } from '../../types/review';

const CLASSIFICATION_COLORS: Record<MoveClassification, string> = {
  brilliant: '#26c2a3',
  great: '#5b8bb6',
  best: '#81b64c',
  excellent: '#81b64c',
  good: '#97af8b',
  book: '#a88865',
  inaccuracy: '#f7c631',
  mistake: '#e58f2a',
  miss: '#e56c2a',
  blunder: '#ca3431',
};

const CLASSIFICATION_LABELS: Record<MoveClassification, string> = {
  brilliant: '💎 Brilliant',
  great: '! Great',
  best: '★ Best',
  excellent: '✓ Excellent',
  good: '· Good',
  book: '📖 Book',
  inaccuracy: '?! Inaccuracy',
  mistake: '? Mistake',
  miss: '?? Miss',
  blunder: '?? Blunder',
};

interface AdvancedStatsModalProps {
  report: GameReviewReport;
  onClose: () => void;
}

export const AdvancedStatsModal: React.FC<AdvancedStatsModalProps> = ({ report, onClose }) => {
  const allClassifications: MoveClassification[] = ['brilliant', 'great', 'best', 'excellent', 'good', 'book', 'inaccuracy', 'mistake', 'miss', 'blunder'];

  const AccuracyRing = ({ accuracy, label, color }: { accuracy: number; label: string; color: string }) => {
    const radius = 38;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (accuracy / 100) * circumference;

    return (
      <div className="flex flex-col items-center gap-1.5">
        <svg width="95" height="95" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r={radius} fill="none" stroke="#252a36" strokeWidth="8" />
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform="rotate(-90 50 50)"
            className="transition-all duration-1000 ease-out"
          />
          <text x="50" y="47" textAnchor="middle" fill="white" fontSize="20" fontWeight="bold">
            {accuracy}
          </text>
          <text x="50" y="62" textAnchor="middle" fill="#9ca3af" fontSize="10" fontWeight="semibold">
            %
          </text>
        </svg>
        <span className="text-xs font-bold text-gray-300">{label}</span>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-[#181a20] rounded-2xl border border-gray-800 w-full max-w-2xl max-h-[88vh] overflow-y-auto shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-[#14161a]">
          <div className="flex items-center gap-2">
            <span className="text-xl">📊</span>
            <h2 className="text-lg font-bold text-white">Advanced Game Review Statistics</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors text-xl font-bold px-2 py-1"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Game Overview Info */}
          <div className="bg-[#14161a] rounded-xl p-4 space-y-2 border border-gray-800/80">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">Opening Identification</span>
              <span className="text-white font-semibold">{report.openingName} ({report.eco})</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">Result</span>
              <span className="text-amber-400 font-bold font-mono">{report.result}</span>
            </div>
            {report.timeControl && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400">Time Control</span>
                <span className="text-white font-mono">{report.timeControl}</span>
              </div>
            )}
            {report.date && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400">Date Played</span>
                <span className="text-gray-300">{report.date}</span>
              </div>
            )}
          </div>

          {/* CAPS Accuracy Gauge */}
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Overall CAPS Accuracy</h3>
            <div className="flex items-center justify-center gap-12 bg-[#14161a] p-4 rounded-xl border border-gray-800/80">
              <AccuracyRing accuracy={report.whiteAccuracy} label={`${report.whitePlayer} (White)`} color="#f3f4f6" />
              <div className="text-gray-600 text-xl font-light">vs</div>
              <AccuracyRing accuracy={report.blackAccuracy} label={`${report.blackPlayer} (Black)`} color="#60a5fa" />
            </div>
          </div>

          {/* Phase-by-Phase Performance */}
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Phase Accuracy Breakdown</h3>
            <div className="grid grid-cols-3 gap-3">
              {(['opening', 'middlegame', 'endgame'] as const).map((phase) => (
                <div key={phase} className="bg-[#14161a] rounded-xl p-3 text-center border border-gray-800/80">
                  <div className="text-xs font-bold text-gray-400 capitalize mb-2">{phase}</div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-gray-400">White</span>
                      <span className="text-white font-bold">{report.stats.phaseAccuracy[phase].white}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gray-200 rounded-full transition-all duration-500"
                        style={{ width: `${report.stats.phaseAccuracy[phase].white}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] pt-1">
                      <span className="text-gray-400">Black</span>
                      <span className="text-blue-400 font-bold">{report.stats.phaseAccuracy[phase].black}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all duration-500"
                        style={{ width: `${report.stats.phaseAccuracy[phase].black}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Move Classification Counts */}
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Move Classification Distribution</h3>
            <div className="grid grid-cols-2 gap-4 bg-[#14161a] p-4 rounded-xl border border-gray-800/80">
              {/* White */}
              <div className="space-y-1.5">
                <div className="text-xs text-gray-300 font-bold mb-2">{report.whitePlayer} (White)</div>
                {allClassifications.map((cls) => {
                  const count = report.stats.white[cls];
                  const total = Object.values(report.stats.white).reduce((a, b) => a + b, 0);
                  const pct = total > 0 ? (count / total) * 100 : 0;
                  return (
                    <div key={cls} className="flex items-center gap-2 text-[11px]">
                      <span className="w-24 text-gray-400 truncate">{CLASSIFICATION_LABELS[cls]}</span>
                      <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${pct}%`, backgroundColor: CLASSIFICATION_COLORS[cls] }}
                        />
                      </div>
                      <span className="text-gray-300 font-mono w-4 text-right font-bold">{count}</span>
                    </div>
                  );
                })}
              </div>

              {/* Black */}
              <div className="space-y-1.5">
                <div className="text-xs text-gray-300 font-bold mb-2">{report.blackPlayer} (Black)</div>
                {allClassifications.map((cls) => {
                  const count = report.stats.black[cls];
                  const total = Object.values(report.stats.black).reduce((a, b) => a + b, 0);
                  const pct = total > 0 ? (count / total) * 100 : 0;
                  return (
                    <div key={cls} className="flex items-center gap-2 text-[11px]">
                      <span className="w-24 text-gray-400 truncate">{CLASSIFICATION_LABELS[cls]}</span>
                      <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${pct}%`, backgroundColor: CLASSIFICATION_COLORS[cls] }}
                        />
                      </div>
                      <span className="text-gray-300 font-mono w-4 text-right font-bold">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
