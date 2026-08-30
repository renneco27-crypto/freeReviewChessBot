'use client';

import React from 'react';
import type { ChessComGameSummary } from '../../types/review';

interface GameListModalProps {
  games: ChessComGameSummary[];
  username: string;
  onSelectGame: (pgn: string) => void;
  onClose: () => void;
  loading?: boolean;
}

export const GameListModal: React.FC<GameListModalProps> = ({ games, username, onSelectGame, onClose, loading }) => {
  const getResultBadge = (game: ChessComGameSummary) => {
    const isWhite = game.white.username.toLowerCase() === username.toLowerCase();
    const playerResult = isWhite ? game.white.result : game.black.result;

    if (playerResult === 'win') return { text: 'WIN', bg: 'bg-green-500/20 text-green-400' };
    if (['checkmated', 'resigned', 'timeout', 'abandoned'].includes(playerResult))
      return { text: 'LOSS', bg: 'bg-red-500/20 text-red-400' };
    return { text: 'DRAW', bg: 'bg-gray-500/20 text-gray-400' };
  };

  const getTimeIcon = (tc: string) => {
    switch (tc) {
      case 'bullet': return '🔴';
      case 'blitz': return '⚡';
      case 'rapid': return '🟢';
      case 'daily': return '📅';
      default: return '♟';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-[#181a20] rounded-2xl border border-gray-800 w-full max-w-xl max-h-[82vh] overflow-hidden shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-[#14161a]">
          <div>
            <h2 className="text-base font-bold text-white">♟ Chess.com Games for {username}</h2>
            <p className="text-xs text-gray-500">{games.length} standard games available</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors text-xl font-bold px-2 py-1">
            ✕
          </button>
        </div>

        {/* Game List Body */}
        <div className="flex-1 overflow-y-auto divide-y divide-gray-800/60">
          {loading && (
            <div className="flex flex-col items-center justify-center py-14 gap-2">
              <div className="w-7 h-7 border-2 border-gray-700 border-t-amber-400 rounded-full animate-spin" />
              <p className="text-xs text-gray-500">Querying Chess.com API...</p>
            </div>
          )}
          {!loading && games.length === 0 && (
            <div className="flex flex-col items-center justify-center py-14 text-gray-500 gap-1">
              <span className="text-3xl">🔍</span>
              <p className="text-sm">No games found for this player.</p>
            </div>
          )}
          {!loading && games.map((game, i) => {
            const result = getResultBadge(game);
            const isWhite = game.white.username.toLowerCase() === username.toLowerCase();
            const opponent = isWhite ? game.black : game.white;
            const playerRating = isWhite ? game.white.rating : game.black.rating;
            const date = new Date(game.end_time * 1000);

            return (
              <button
                key={i}
                onClick={() => onSelectGame(game.pgn)}
                className="w-full flex items-center gap-3 px-6 py-3.5 hover:bg-white/5 transition-colors text-left"
              >
                <span className="text-lg">{getTimeIcon(game.time_class)}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-white font-semibold text-sm truncate">
                      vs {opponent.username}
                    </span>
                    <span className="text-gray-400 text-xs">({opponent.rating})</span>
                  </div>
                  <div className="text-[11px] text-gray-500 flex items-center gap-2 mt-0.5">
                    <span className="capitalize">{game.time_class} • {game.time_control}</span>
                    <span>•</span>
                    <span>{date.toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="text-xs text-gray-400 font-mono">{playerRating}</span>
                  <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${result.bg}`}>
                    {result.text}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
