'use client';

import { useState } from 'react';
import { fetchChesscomGames } from '@/lib/api';
import { parseGamesToTree } from '@/lib/repertoire';
import { BuilderNode, buildRepertoireTree } from '@/lib/builder';
import { useEngine } from '@/hooks/useEngine';
import RepertoireGraph from '@/components/RepertoireGraph';
import { Chessboard } from 'react-chessboard';

export default function BuilderPage() {
  const [username, setUsername] = useState('');
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState(0);
  const [tree, setTree] = useState<BuilderNode | null>(null);
  const [evaluatingFen, setEvaluatingFen] = useState<string | null>(null);
  const { isReady, evaluatePosition } = useEngine();

  const handleGenerate = async () => {
    if (!username) return;
    setStatus('Fetching games from Chess.com...');
    setProgress(5);
    
    try {
      const pgns = await fetchChesscomGames(username, 50); // Get more games to ensure we find an opening
      if (!pgns) {
        setStatus('No games found for this user.');
        return;
      }
      
      setStatus('Parsing repertoire...');
      setProgress(10);
      const repTree = parseGamesToTree(pgns, 1); // We just need the first move
      
      if (repTree.length === 0) {
        setStatus('Could not parse any openings from games.');
        return;
      }
      
      // Sort by count
      repTree.sort((a, b) => b.count - a.count);
      
      // Find one with count >= 3, else just the most common
      let rootOpening = repTree.find(n => n.count >= 3);
      if (!rootOpening) rootOpening = repTree[0];
      
      setStatus(`Found core opening: ${rootOpening.san}. Generating Engine Pipeline...`);
      setProgress(15);
      
      // Root fen after the user plays their first move
      // e.g. e4. The turn is now 'b' (opponent).
      
      // We will build up to 15 full moves (30 ply)
      // Since the first move is already made, there are 29 plies left.
      // We pass maxFullMoves = 15.
      
      const generatedTree = await buildRepertoireTree(
        rootOpening.fen,
        'w', // Assuming the user is playing white for this repertoire
        15,
        evaluatePosition,
        (completed, total, currentFen) => {
          // Progress roughly starts at 15%, goes up to 100%
          const percentage = 15 + Math.floor((completed / Math.max(150, total)) * 85);
          setProgress(Math.min(100, percentage));
          setStatus(`Evaluating positions: ${completed} / ~${Math.max(150, total)}`);
          if (currentFen) setEvaluatingFen(currentFen);
        }
      );
      
      // Update root node label to the actual opening move instead of "Root"
      generatedTree.moveSan = rootOpening.san;
      
      setTree(generatedTree);
      setStatus('Repertoire generated successfully!');
      setProgress(100);
      
    } catch (e: any) {
      console.error(e);
      setStatus(`Error: ${e.message}`);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 p-4 shadow-sm z-10 flex flex-col md:flex-row items-center justify-between gap-4 border-b dark:border-gray-800">
        <div>
          <h1 className="text-2xl font-bold">Automated Repertoire Builder</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Maia & Stockfish Engine Pipeline</p>
        </div>
        
        <div className="flex items-center gap-4 w-full md:w-auto">
          <input
            type="text"
            className="border dark:border-gray-700 bg-transparent p-2 rounded-md w-full md:w-64"
            placeholder="Chess.com Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <button
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md whitespace-nowrap font-medium disabled:opacity-50"
            onClick={handleGenerate}
            disabled={!isReady || !username || (progress > 0 && progress < 100)}
          >
            {progress > 0 && progress < 100 ? 'Generating...' : 'Build Repertoire'}
          </button>
        </div>
      </div>
      
      {/* Progress Bar */}
      {progress > 0 && (
        <div className="bg-gray-200 h-2 w-full">
          <div 
            className="bg-blue-600 h-2 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
      
      {/* Status bar */}
      <div className="bg-white dark:bg-gray-900 px-4 py-2 border-b dark:border-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300">
        Status: {isReady ? status || 'Waiting for input...' : 'Loading Stockfish WebAssembly...'}
      </div>
      
      {/* Graph Area */}
      <div className="flex-1 overflow-hidden relative">
        {tree ? (
          <RepertoireGraph root={tree} />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-gray-400 bg-gray-50 dark:bg-gray-950">
            {progress > 0 && progress < 100 && evaluatingFen ? (
              <div className="w-[400px] h-[400px] shadow-2xl rounded-sm border-4 border-gray-800 dark:border-gray-700">
                {/* @ts-ignore */}
                <Chessboard position={evaluatingFen} arePiecesDraggable={false} animationDuration={100} />
              </div>
            ) : (
              <span>{progress > 0 ? 'Building visualizer...' : 'Enter a username to begin.'}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
