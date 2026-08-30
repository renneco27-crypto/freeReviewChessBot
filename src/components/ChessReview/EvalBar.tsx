'use client';

import React from 'react';

interface EvalBarProps {
  eval_: number; // centipawns (from white's perspective)
  mate?: number;
}

export const EvalBar: React.FC<EvalBarProps> = ({ eval_, mate }) => {
  let whitePercent: number;
  let displayText: string;

  if (mate !== undefined && mate !== null) {
    whitePercent = mate > 0 ? 100 : 0;
    displayText = mate > 0 ? `+M${Math.abs(mate)}` : `-M${Math.abs(mate)}`;
  } else {
    const cp = Math.max(-1000, Math.min(1000, eval_));
    whitePercent = 50 + (cp / 1000) * 45;
    whitePercent = Math.max(5, Math.min(95, whitePercent));

    const displayVal = Math.abs(cp) / 100;
    displayText = cp >= 0 ? `+${displayVal.toFixed(1)}` : `-${displayVal.toFixed(1)}`;
  }

  return (
    <div className="flex flex-col items-center h-full w-7 rounded-lg overflow-hidden border border-gray-700 select-none bg-gray-900 shadow-md">
      {/* Black's section */}
      <div
        className="w-full bg-[#2c2e35] transition-all duration-300 ease-out flex items-start justify-center"
        style={{ height: `${100 - whitePercent}%` }}
      >
        {whitePercent < 50 && (
          <span className="text-gray-200 text-[10px] font-bold mt-1.5 leading-none">
            {displayText}
          </span>
        )}
      </div>
      {/* White's section */}
      <div
        className="w-full bg-[#f1f3f7] transition-all duration-300 ease-out flex items-end justify-center"
        style={{ height: `${whitePercent}%` }}
      >
        {whitePercent >= 50 && (
          <span className="text-gray-900 text-[10px] font-bold mb-1.5 leading-none">
            {displayText}
          </span>
        )}
      </div>
    </div>
  );
};
