'use client';

import React, { useMemo } from 'react';
import { Chess } from 'chess.js';
import type { MoveAnalysis, MoveClassification } from '../../types/review';

const PIECE_UNICODE: Record<string, Record<string, string>> = {
  w: { p: '♙', n: '♘', b: '♗', r: '♖', q: '♕', k: '♔' },
  b: { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚' },
};

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

interface BoardProps {
  fen: string;
  currentMove?: MoveAnalysis | null;
  flipped?: boolean;
}

export const Board: React.FC<BoardProps> = ({ fen, currentMove, flipped = false }) => {
  const board = useMemo(() => {
    try {
      const chess = new Chess(fen);
      return chess.board();
    } catch {
      return new Chess().board();
    }
  }, [fen]);

  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const ranks = [8, 7, 6, 5, 4, 3, 2, 1];

  const displayRanks = flipped ? [...ranks].reverse() : ranks;
  const displayFiles = flipped ? [...files].reverse() : files;

  const highlightSquares = new Set<string>();
  let arrowFrom = '';
  let arrowTo = '';
  let arrowColor = '#81b64c';

  if (currentMove) {
    highlightSquares.add(currentMove.from);
    highlightSquares.add(currentMove.to);
    arrowFrom = currentMove.from;
    arrowTo = currentMove.to;
    arrowColor = CLASSIFICATION_COLORS[currentMove.classification] || '#81b64c';
  }

  const squareToCoords = (sq: string): { x: number; y: number } => {
    const fileIdx = displayFiles.indexOf(sq[0]);
    const rankIdx = displayRanks.indexOf(parseInt(sq[1]));
    return { x: fileIdx * 75 + 37.5, y: rankIdx * 75 + 37.5 };
  };

  return (
    <div className="relative select-none w-full max-w-[560px]">
      <svg
        viewBox="0 0 600 600"
        className="w-full rounded-xl shadow-2xl border border-gray-800"
        style={{ aspectRatio: '1/1' }}
      >
        {/* Board squares */}
        {displayRanks.map((rank, ri) =>
          displayFiles.map((file, fi) => {
            const isLight = (files.indexOf(file) + ranks.indexOf(rank)) % 2 === 0;
            const sq = `${file}${rank}`;
            const isHighlighted = highlightSquares.has(sq);

            return (
              <rect
                key={sq}
                x={fi * 75}
                y={ri * 75}
                width={75}
                height={75}
                fill={
                  isHighlighted
                    ? isLight
                      ? '#f6f668'
                      : '#bbca2b'
                    : isLight
                    ? '#eceed2'
                    : '#769656'
                }
              />
            );
          })
        )}

        {/* Coordinate labels */}
        {displayFiles.map((file, fi) => (
          <text
            key={`file-${file}`}
            x={fi * 75 + 63}
            y={593}
            fill={fi % 2 === 0 ? '#769656' : '#eceed2'}
            fontSize="12"
            fontWeight="bold"
            fontFamily="sans-serif"
          >
            {file}
          </text>
        ))}
        {displayRanks.map((rank, ri) => (
          <text
            key={`rank-${rank}`}
            x={5}
            y={ri * 75 + 16}
            fill={ri % 2 === 0 ? '#eceed2' : '#769656'}
            fontSize="12"
            fontWeight="bold"
            fontFamily="sans-serif"
          >
            {rank}
          </text>
        ))}

        {/* Move arrow */}
        {arrowFrom && arrowTo && (
          <>
            <defs>
              <marker
                id="reviewArrowhead"
                markerWidth="12"
                markerHeight="8"
                refX="10"
                refY="4"
                orient="auto"
              >
                <polygon points="0 0, 12 4, 0 8" fill={arrowColor} opacity={0.85} />
              </marker>
            </defs>
            <line
              x1={squareToCoords(arrowFrom).x}
              y1={squareToCoords(arrowFrom).y}
              x2={squareToCoords(arrowTo).x}
              y2={squareToCoords(arrowTo).y}
              stroke={arrowColor}
              strokeWidth={7}
              strokeLinecap="round"
              opacity={0.8}
              markerEnd="url(#reviewArrowhead)"
            />
          </>
        )}

        {/* Pieces */}
        {displayRanks.map((rank, ri) =>
          displayFiles.map((file, fi) => {
            const boardRow = 8 - rank;
            const boardCol = files.indexOf(file);
            const piece = board[boardRow]?.[boardCol];
            if (!piece) return null;

            return (
              <text
                key={`piece-${file}${rank}`}
                x={fi * 75 + 37.5}
                y={ri * 75 + 53}
                textAnchor="middle"
                fontSize="52"
                style={{
                  filter: piece.color === 'b' ? 'drop-shadow(1px 1px 1px rgba(255,255,255,0.4))' : 'drop-shadow(1px 1px 2px rgba(0,0,0,0.6))',
                  cursor: 'default',
                }}
              >
                {PIECE_UNICODE[piece.color][piece.type]}
              </text>
            );
          })
        )}

        {/* Classification badge dot on target square */}
        {currentMove && (
          <circle
            cx={squareToCoords(currentMove.to).x}
            cy={squareToCoords(currentMove.to).y - 28}
            r={9}
            fill={arrowColor}
            stroke="#ffffff"
            strokeWidth={2.5}
          />
        )}
      </svg>
    </div>
  );
};
