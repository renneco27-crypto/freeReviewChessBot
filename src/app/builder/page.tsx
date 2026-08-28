'use client';

import { useState, useEffect } from 'react';
import { flushSync } from 'react-dom';
import { fetchChesscomGames } from '@/lib/api';
import { parseGamesToTree } from '@/lib/repertoire';
import { BuilderNode, buildRepertoireTree } from '@/lib/builder';
import { useEngine } from '@/hooks/useEngine';
import RepertoireGraph from '@/components/RepertoireGraph';
import { Chessboard } from 'react-chessboard';

const STORAGE_KEY = 'repertoire_tree_v1';

export default function BuilderPage() {
  const [username, setUsername] = useState('');
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState(0);
  const [tree, setTree] = useState<BuilderNode | null>(null);
  const [evaluatingFen, setEvaluatingFen] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const { isReady, evaluatePosition } = useEngine();

  // Load saved tree from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setTree(parsed.tree);
        setUsername(parsed.username || '');
        setStatus('Loaded saved repertoire from cache.');
        setProgress(100);
        setIsSaved(true);
      }
    } catch (e) {
      console.error('Failed to load saved tree', e);
    }
  }, []);

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
          // flushSync forces React to flush state immediately instead of batching,
          // so the chessboard visually updates piece-by-piece before the delay
          flushSync(() => {
            const percentage = 15 + Math.floor((completed / Math.max(150, total)) * 85);
            setProgress(Math.min(100, percentage));
            setStatus(`Evaluating positions: ${completed} / ~${Math.max(150, total)}`);
            if (currentFen) setEvaluatingFen(currentFen);
          });
        }
      );
      
      // Update root node label to the actual opening move instead of "Root"
      generatedTree.moveSan = rootOpening.san;
      
      setTree(generatedTree);
      // Auto-save to localStorage immediately
      const saveData = { tree: generatedTree, username, savedAt: new Date().toISOString() };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saveData));
      setIsSaved(true);
      setStatus('Repertoire generated and saved!');
      setProgress(100);
      
    } catch (e: any) {
      console.error(e);
      setStatus(`Error: ${e.message}`);
    }
  };

  const handleSave = () => {
    if (!tree) return;
    const saveData = { tree, username, savedAt: new Date().toISOString() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saveData));
    setIsSaved(true);
    setStatus('Repertoire saved!');
  };

  const handleClear = () => {
    if (!confirm('Clear the saved repertoire? This cannot be undone.')) return;
    localStorage.removeItem(STORAGE_KEY);
    setTree(null);
    setProgress(0);
    setIsSaved(false);
    setStatus('');
  };

  const handleDeleteNode = (nodeId: string) => {
    if (!tree) return;
    // Recursively remove the node from the tree
    const removeNode = (node: BuilderNode): BuilderNode | null => {
      if (node.id === nodeId) return null;
      return { ...node, children: node.children.map(removeNode).filter(Boolean) as BuilderNode[] };
    };
    const updatedTree = removeNode(tree);
    if (updatedTree) {
      setTree(updatedTree);
      setIsSaved(false); // Mark as unsaved after edits
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
        
        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
          <input
            type="text"
            className="border dark:border-gray-700 bg-transparent p-2 rounded-md w-full md:w-48"
            placeholder="Chess.com Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <button
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md whitespace-nowrap font-medium disabled:opacity-50"
            onClick={handleGenerate}
            disabled={!isReady || !username || (progress > 0 && progress < 100)}
          >
            {progress > 0 && progress < 100 ? 'Generating...' : 'Build Repertoire'}
          </button>
          {tree && (
            <>
              <button
                className={`px-4 py-2 rounded-md whitespace-nowrap font-medium border ${isSaved ? 'border-green-500 text-green-600' : 'border-yellow-500 text-yellow-600 animate-pulse'}`}
                onClick={handleSave}
              >
                {isSaved ? '✓ Saved' : '💾 Save Changes'}
              </button>
              <button
                className="px-4 py-2 rounded-md whitespace-nowrap font-medium border border-red-400 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                onClick={handleClear}
              >
                🗑 Clear
              </button>
            </>
          )}
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
          <RepertoireGraph root={tree} onDeleteNode={handleDeleteNode} />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-gray-400 bg-gray-50 dark:bg-gray-950">
            {progress > 0 && progress < 100 && evaluatingFen ? (
              <div className="w-[400px] h-[400px] shadow-2xl rounded-sm border-4 border-gray-800 dark:border-gray-700">
                <Chessboard 
                  options={{ id: 'builder-board', position: evaluatingFen, allowDragging: false, animationDurationInMs: 300 }} 
                />
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
