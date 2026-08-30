'use client';

import React, { useState } from 'react';
import type { MoveAnalysis } from '../../types/review';

interface EvalGraphProps {
  moves: MoveAnalysis[];
  currentPly: number;
  onMoveClick: (ply: number) => void;
}

export const EvalGraph: React.FC<EvalGraphProps> = ({ moves, currentPly, onMoveClick }) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const evals = [0, ...moves.map(m => Math.max(-600, Math.min(600, m.evalAfter)) / 100)];
  const width = 600;
  const height = 130;
  const padding = 20;

  const points = evals.map((val, idx) => {
    const x = padding + (idx / Math.max(evals.length - 1, 1)) * (width - padding * 2);
    // val ranges from -6 to +6. map +6 to padding, -6 to height - padding
    const y = height / 2 - (val / 6) * (height / 2 - padding);
    return { x, y, val, idx };
  });

  const zeroY = height / 2;

  // Build SVG path
  let pathD = `M ${points[0]?.x || 0} ${points[0]?.y || zeroY}`;
  points.forEach((p, i) => {
    if (i > 0) pathD += ` L ${p.x} ${p.y}`;
  });

  // Closed area path for white advantage (top)
  const topAreaD = `${pathD} L ${points[points.length - 1]?.x || width} ${zeroY} L ${points[0]?.x || padding} ${zeroY} Z`;

  const hoveredPoint = hoverIndex !== null ? points[hoverIndex] : null;
  const currentPoint = currentPly >= 0 && currentPly < points.length ? points[currentPly] : null;

  return (
    <div className="w-full bg-[#181a20] rounded-xl border border-gray-800 p-3 shadow-inner select-none relative">
      <div className="flex items-center justify-between text-xs text-gray-400 mb-1 px-1 font-semibold">
        <span>Advantage Chart</span>
        <span className="text-[11px] font-mono text-gray-500">
          {moves.length} moves • {currentPly > 0 ? `Move ${Math.ceil(currentPly / 2)}${currentPly % 2 === 1 ? '.' : '...'} (${evals[currentPly] > 0 ? '+' : ''}${evals[currentPly]?.toFixed(1)})` : 'Start'}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-[120px] overflow-visible cursor-pointer"
        onMouseLeave={() => setHoverIndex(null)}
      >
        <defs>
          <linearGradient id="whiteAdvGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#81b64c" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#81b64c" stopOpacity="0.05" />
          </linearGradient>
          <linearGradient id="blackAdvGradient" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#ca3431" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#ca3431" stopOpacity="0.05" />
          </linearGradient>
        </defs>

        {/* Zero baseline */}
        <line
          x1={padding}
          y1={zeroY}
          x2={width - padding}
          y2={zeroY}
          stroke="#3d4452"
          strokeWidth="1.5"
          strokeDasharray="4 4"
        />

        {/* Advantage Area */}
        <path d={topAreaD} fill="url(#whiteAdvGradient)" />

        {/* Line graph */}
        <path
          d={pathD}
          fill="none"
          stroke="#81b64c"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Current Move Indicator */}
        {currentPoint && (
          <>
            <line
              x1={currentPoint.x}
              y1={padding}
              x2={currentPoint.x}
              y2={height - padding}
              stroke="#fbbf24"
              strokeWidth="2"
              strokeDasharray="3 3"
            />
            <circle
              cx={currentPoint.x}
              cy={currentPoint.y}
              r="5"
              fill="#fbbf24"
              stroke="#ffffff"
              strokeWidth="2"
            />
          </>
        )}

        {/* Interactive Click/Hover Areas */}
        {points.map((p) => (
          <rect
            key={p.idx}
            x={p.x - 7}
            y={0}
            width={14}
            height={height}
            fill="transparent"
            onMouseEnter={() => setHoverIndex(p.idx)}
            onClick={() => onMoveClick(p.idx)}
          />
        ))}

        {/* Hover Tooltip Dot */}
        {hoveredPoint && (
          <circle
            cx={hoveredPoint.x}
            cy={hoveredPoint.y}
            r="4.5"
            fill="#60a5fa"
            stroke="#ffffff"
            strokeWidth="1.5"
          />
        )}
      </svg>
    </div>
  );
};
