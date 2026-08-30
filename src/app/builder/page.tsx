'use client';

import { useState, useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import { fetchChesscomGames } from '@/lib/api';
import { 
  parseGamesToTree, 
  parseRepertoirePgnToTree, 
  convertRepertoireNodeToBuilderNode, 
  DecompiledLine, 
  RepertoireNode 
} from '@/lib/repertoire';
import { BuilderNode, buildRepertoireTree } from '@/lib/builder';
import { useEngine } from '@/hooks/useEngine';
import RepertoireGraph from '@/components/RepertoireGraph';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';

const STORAGE_KEY = 'repertoire_tree_v1';

const SAMPLE_SCOTCH_PGN = `[Event "white Repertoire"]
[Site "chessbook.com"]
[Date ""]
[Round "N/A"]
[White "N/A"]
[Black "N/A"]
[Result "*"]

1. e4 e5 2. Nf3 Nc6 3. d4 exd4 (3... d6 4. dxe5 dxe5 5. Qxd8+ Nxd8 (5... Kxd8 6. Nc3 Bd7 7. Bc4) 6. Nxe5 Nf6 7. Nc3 Bb4 8. f3 O-O 9. Nd3 Bxc3+ 10. bxc3 b6 11. Nf4 Re8 12. a4 Ne6 13. Kf2 a5 14. g4) (3... Nf6 4. d5 Nd4 5. Nxe5 d6 6. Nc4 c5 7. c3 Nb5 8. a4 Nc7 9. Bd3 Be7 10. O-O) (3... f6 4. Bc4 exd4 5. O-O Bc5 6. c3 dxc3 7. Bxg8 Rxg8 8. Qd5) (3... d5 4. Nxe5 Nxe5 5. dxe5 d4 6. c3 Bc5 7. Bc4 Ne7 8. e6 Bxe6 9. Bxe6 fxe6 10. Qh5+ Kf8 11. Qxc5) (3... Bb4+ 4. c3 Ba5 5. a4 Nf6 6. b4 Bb6 7. a5) (3... Nxd4 4. Nxd4 exd4 5. Qxd4 Nf6 (5... d6 6. Nc3 Nf6 7. Bf4 Be7 8. O-O-O O-O 9. f3 Be6 10. Kb1 c5 11. Qf2 (11. Qe3 a6 12. Bxd6 Bxd6 13. e5 Ne8 14. exd6 Qa5 15. a3 Rd8 16. Ne4) Qa5 12. Bxd6 Bxd6 13. Rxd6 b5 14. Qxc5 Rac8 15. Qxb5 Bxa2+ 16. Nxa2 Qe1+ 17. Nc1 Rb8 18. Qd3) (5... c5 6. Qe3 d6 7. Nc3 Nf6 8. Qg3 Be6 9. Bb5+ Bd7 10. Bxd7+ Qxd7 11. Bg5 Be7 12. O-O-O O-O-O 13. e5 Nh5 14. Qh4 Bxg5+ 15. Qxg5 g6 16. Rxd6 Qc7 17. Rhd1 Rxd6 18. exd6 Qd7 19. Qxc5+) 6. e5 Nh5 7. g4) 4. Nxd4 Nxd4 (4... Bc5 5. Nb3 Bb6 6. Qe2 d6 7. Nc3 Nf6 8. Be3 O-O 9. O-O-O Re8 10. f3 Be6 11. Kb1 Qe7 12. g4 Nd7 13. h4 Nde5 14. g5 Bc4 15. Qf2 Bxf1 16. Qxf1 Bxe3 17. Nd5 Qe6 18. Nxe3 a5 19. a3 b5 20. Nd5 a4 21. Nd2) (4... Nf6 5. Nc3 Bb4 (5... Nxd4 6. Qxd4 d6 7. Bf4 Be7 8. O-O-O O-O 9. f3 Be6 10. Kb1 c5 11. Qf2 (11. Qe3 a6 12. Bxd6 Bxd6 13. e5 Ne8 14. exd6 Qa5 15. a3 Rd8 16. Ne4) Qa5 12. Bxd6 Bxd6 13. Rxd6 b5 14. Qxc5 Rac8 15. Qxb5 Bxa2+ 16. Nxa2 Qe1+ 17. Nc1 Rb8 18. Qd3) 6. Nxc6 bxc6 7. Bd3 d5 8. Bd2 O-O 9. O-O Bxc3 10. Bxc3 dxe4 11. Bxf6 Qxf6 12. Bxe4 Qxb2 13. Bxc6 Rb8 14. Rb1 Qxb1 15. Qxb1 Rxb1 16. Rxb1 Be6 17. Rb7 Rd8 18. Kf1 Bxa2 19. Rxa7 Bc4+ 20. Ke1 Rc8 21. Bd7 Rd8 22. Rxc7 Be6 23. Bxe6) 5. Qxd4 Nf6 (5... d6 6. Nc3 Nf6 7. Bf4 Be7 8. O-O-O O-O 9. f3 Be6 10. Kb1 c5 11. Qf2 (11. Qe3 a6 12. Bxd6 Bxd6 13. e5 Ne8 14. exd6 Qa5 15. a3 Rd8 16. Ne4) Qa5 12. Bxd6 Bxd6 13. Rxd6 b5 14. Qxc5 Rac8 15. Qxb5 Bxa2+ 16. Nxa2 Qe1+ 17. Nc1 Rb8 18. Qd3) (5... c5 6. Qe3 d6 7. Nc3 Nf6 8. Qg3 Be6 9. Bb5+ Bd7 10. Bxd7+ Qxd7 11. Bg5 Be7 12. O-O-O O-O-O 13. e5 Nh5 14. Qh4 Bxg5+ 15. Qxg5 g6 16. Rxd6 Qc7 17. Rhd1 Rxd6 18. exd6 Qd7 19. Qxc5+) 6. e5 Nh5 7. g4 *`;

export default function BuilderPage() {
  const [username, setUsername] = useState('');
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState(0);
  const [tree, setTree] = useState<BuilderNode | null>(null);
  const [evaluatingFen, setEvaluatingFen] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  
  // PGN Decompiler States
  const [showPgnModal, setShowPgnModal] = useState(false);
  const [pgnInput, setPgnInput] = useState('');
  const [decompiledLines, setDecompiledLines] = useState<DecompiledLine[]>([]);
  const [selectedLineIndex, setSelectedLineIndex] = useState<number | null>(null);
  const [previewFen, setPreviewFen] = useState<string | null>(null);
  const [activeLinePly, setActiveLinePly] = useState<number>(0);

  const { isReady, evaluatePosition } = useEngine();
  const abortRef = useRef(false);

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
    abortRef.current = false;
    setStatus('Fetching games from Chess.com...');
    setProgress(5);
    
    try {
      const pgns = await fetchChesscomGames(username, 50);
      if (!pgns) {
        setStatus('No games found for this user.');
        return;
      }
      
      setStatus('Parsing repertoire...');
      setProgress(10);
      const repTree = parseGamesToTree(pgns, 1);
      
      if (repTree.length === 0) {
        setStatus('Could not parse any openings from games.');
        return;
      }
      
      repTree.sort((a, b) => b.count - a.count);
      let rootOpening = repTree.find(n => n.count >= 3) || repTree[0];
      
      setStatus(`Found core opening: ${rootOpening.san}. Generating Engine Pipeline...`);
      setProgress(15);
      
      const generatedTree = await buildRepertoireTree(
        rootOpening.fen,
        'w',
        15,
        evaluatePosition,
        (completed, total, currentFen) => {
          flushSync(() => {
            const percentage = 15 + Math.floor((completed / Math.max(150, total)) * 85);
            setProgress(Math.min(100, percentage));
            setStatus(`Evaluating positions: ${completed} / ~${Math.max(150, total)}`);
            if (currentFen) setEvaluatingFen(currentFen);
          });
        },
        abortRef
      );
      
      generatedTree.moveSan = rootOpening.san;
      setTree(generatedTree);
      
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

  const handlePgnDecompile = (textToParse?: string) => {
    const text = textToParse || pgnInput;
    if (!text.trim()) {
      alert('Please enter or paste a PGN string.');
      return;
    }

    try {
      const { root, lines } = parseRepertoirePgnToTree(text);
      setDecompiledLines(lines);
      
      const builderRoot = convertRepertoireNodeToBuilderNode(root);
      setTree(builderRoot);
      setIsSaved(true);
      setShowPgnModal(false);
      setStatus(`Successfully decompiled PGN into ${lines.length} distinct lines!`);
      setProgress(100);

      if (lines.length > 0) {
        selectDecompiledLine(0, lines);
      }
    } catch (e: any) {
      console.error(e);
      alert('Failed to parse PGN: ' + e.message);
    }
  };

  const selectDecompiledLine = (index: number, linesList = decompiledLines) => {
    setSelectedLineIndex(index);
    const line = linesList[index];
    if (line) {
      setActiveLinePly(0);
      setPreviewFen(line.nodes[0]?.fen || null);
    }
  };

  const handleStepLineMove = (delta: number) => {
    if (selectedLineIndex === null || !decompiledLines[selectedLineIndex]) return;
    const line = decompiledLines[selectedLineIndex];
    const newPly = Math.max(0, Math.min(line.nodes.length, activeLinePly + delta));
    setActiveLinePly(newPly);
    if (newPly === 0) {
      setPreviewFen(null); // start position
    } else {
      setPreviewFen(line.nodes[newPly - 1]?.fen || null);
    }
  };

  const handleStop = () => {
    abortRef.current = true;
    setStatus('Stopping generation and saving progress...');
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
    setDecompiledLines([]);
    setSelectedLineIndex(null);
    setProgress(0);
    setIsSaved(false);
    setStatus('');
  };

  const handleDeleteNode = (nodeId: string) => {
    if (!tree) return;
    const removeNode = (node: BuilderNode): BuilderNode | null => {
      if (node.id === nodeId) return null;
      return { ...node, children: node.children.map(removeNode).filter(Boolean) as BuilderNode[] };
    };
    const updatedTree = removeNode(tree);
    if (updatedTree) {
      setTree(updatedTree);
      setIsSaved(false);
    }
  };

  const isGenerating = progress > 0 && progress < 100;

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 p-4 shadow-sm z-10 flex flex-col md:flex-row items-center justify-between gap-4 border-b dark:border-gray-800">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <span>♟️ Repertoire Builder & PGN Decompiler</span>
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Multi-Branch Repertoire Tree Explorer & Engine Pipeline</p>
        </div>
        
        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
          <button
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-md font-medium text-sm flex items-center gap-1.5"
            onClick={() => setShowPgnModal(true)}
          >
            📥 Import PGN Repertoire
          </button>

          <input
            type="text"
            className="border dark:border-gray-700 bg-transparent p-2 rounded-md w-full md:w-44 text-sm"
            placeholder="Chess.com Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={isGenerating}
          />
          {isGenerating ? (
            <button
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md whitespace-nowrap font-medium text-sm animate-pulse"
              onClick={handleStop}
            >
              ⏹ Stop
            </button>
          ) : (
            <button
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md whitespace-nowrap font-medium text-sm disabled:opacity-50"
              onClick={handleGenerate}
              disabled={!isReady || !username}
            >
              Build from Games
            </button>
          )}

          {tree && !isGenerating && (
            <>
              <button
                className={`px-3 py-2 rounded-md whitespace-nowrap font-medium text-sm border ${isSaved ? 'border-green-500 text-green-600' : 'border-yellow-500 text-yellow-600 animate-pulse'}`}
                onClick={handleSave}
              >
                {isSaved ? '✓ Saved' : '💾 Save'}
              </button>
              <button
                className="px-3 py-2 rounded-md whitespace-nowrap font-medium text-sm border border-red-400 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
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
      <div className="bg-white dark:bg-gray-900 px-4 py-2 border-b dark:border-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300 flex justify-between items-center">
        <span>Status: {isReady ? status || 'Ready' : 'Loading Stockfish WebAssembly...'}</span>
        {decompiledLines.length > 0 && (
          <span className="text-xs px-2.5 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-full font-semibold">
            {decompiledLines.length} Decompiled Lines Active
          </span>
        )}
      </div>

      {/* Main Workspace: Sidebar Lines + Main Graph View + Preview Board */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar: Decompiled Variations List */}
        {decompiledLines.length > 0 && (
          <div className="w-80 border-r dark:border-gray-800 bg-white dark:bg-gray-900 flex flex-col overflow-hidden">
            <div className="p-3 border-b dark:border-gray-800 font-semibold text-sm flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
              <span>Opening Variations ({decompiledLines.length})</span>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {decompiledLines.map((line, idx) => (
                <div
                  key={line.id}
                  onClick={() => selectDecompiledLine(idx)}
                  className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                    selectedLineIndex === idx
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-100 font-medium shadow-sm'
                      : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 bg-white dark:bg-gray-900'
                  }`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-blue-600 dark:text-blue-400">{line.name}</span>
                    <span className="text-[10px] text-gray-500">{line.moves.length} plies</span>
                  </div>
                  <div className="text-gray-600 dark:text-gray-400 font-mono line-clamp-2 text-[11px]">
                    {line.formattedPgn}
                  </div>
                </div>
              ))}
            </div>

            {/* Selected Line Move Controller */}
            {selectedLineIndex !== null && decompiledLines[selectedLineIndex] && (
              <div className="p-3 border-t dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40">
                <div className="text-xs font-semibold mb-2 flex justify-between">
                  <span>Line Playthrough:</span>
                  <span className="text-blue-500">
                    Ply {activeLinePly} / {decompiledLines[selectedLineIndex].moves.length}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    className="flex-1 py-1.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded text-xs font-bold"
                    onClick={() => handleStepLineMove(-1)}
                  >
                    ◀ Prev
                  </button>
                  <button
                    className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-bold"
                    onClick={() => handleStepLineMove(1)}
                  >
                    Next ▶
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* Center: Graph & Visualizer */}
        <div className="flex-1 overflow-hidden relative">
          {tree ? (
            <RepertoireGraph root={tree} onDeleteNode={handleDeleteNode} />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 bg-gray-50 dark:bg-gray-950 p-6">
              {progress > 0 && progress < 100 && evaluatingFen ? (
                <div className="w-[400px] h-[400px] shadow-2xl rounded-sm border-4 border-gray-800 dark:border-gray-700">
                  <Chessboard 
                    options={{ id: 'builder-board', position: evaluatingFen, allowDragging: false, animationDurationInMs: 300 }} 
                  />
                </div>
              ) : (
                <div className="max-w-md text-center space-y-4">
                  <div className="text-5xl">♟️</div>
                  <h3 className="text-xl font-bold text-gray-700 dark:text-gray-200">No Repertoire Loaded</h3>
                  <p className="text-sm text-gray-500">
                    Import a multi-branch PGN file (e.g. from Chessbook) or enter your Chess.com username to build a tree with the Stockfish engine.
                  </p>
                  <div className="flex justify-center gap-3 pt-2">
                    <button
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-sm font-medium"
                      onClick={() => {
                        setPgnInput(SAMPLE_SCOTCH_PGN);
                        handlePgnDecompile(SAMPLE_SCOTCH_PGN);
                      }}
                    >
                      ⚡ Load Sample Scotch Game PGN
                    </button>
                    <button
                      className="px-4 py-2 border dark:border-gray-700 rounded-md text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800"
                      onClick={() => setShowPgnModal(true)}
                    >
                      Paste / Upload PGN
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Corner Floating Mini Board (when previewing a line) */}
        {previewFen && (
          <div className="absolute bottom-6 right-6 w-64 h-64 bg-white dark:bg-gray-900 border-2 border-blue-500 shadow-2xl rounded-lg p-2 z-20">
            <div className="flex justify-between items-center mb-1 text-[11px] font-semibold text-gray-700 dark:text-gray-300">
              <span>Preview Position (Ply {activeLinePly})</span>
              <button onClick={() => setPreviewFen(null)} className="text-gray-400 hover:text-red-500">✕</button>
            </div>
            <div className="w-full h-52">
              <Chessboard options={{ id: 'mini-preview', position: previewFen, allowDragging: false }} />
            </div>
          </div>
        )}
      </div>

      {/* PGN Import Modal */}
      {showPgnModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 border dark:border-gray-800 rounded-xl max-w-2xl w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b dark:border-gray-800 pb-3">
              <h3 className="text-lg font-bold">Import Multi-Variation Repertoire PGN</h3>
              <button onClick={() => setShowPgnModal(false)} className="text-gray-400 hover:text-gray-200">✕</button>
            </div>
            
            <p className="text-xs text-gray-500">
              Paste any repertoire PGN with nested variations `(...)` (such as Chessbook or ChessBase exports). The decompiler will extract all distinct branching lines.
            </p>

            <textarea
              className="w-full h-44 p-3 font-mono text-xs border dark:border-gray-700 bg-gray-50 dark:bg-gray-950 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Paste PGN text here..."
              value={pgnInput}
              onChange={(e) => setPgnInput(e.target.value)}
            />

            <div className="flex justify-between items-center pt-2">
              <div className="flex gap-2">
                <button
                  className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md text-xs font-medium"
                  onClick={() => {
                    setPgnInput(SAMPLE_SCOTCH_PGN);
                  }}
                >
                  Load Scotch Game Sample
                </button>
                <label className="px-3 py-1.5 border dark:border-gray-700 rounded-md text-xs font-medium cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 inline-flex items-center">
                  <span>📁 Upload .pgn File</span>
                  <input
                    type="file"
                    accept=".pgn"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                          const res = ev.target?.result as string;
                          setPgnInput(res);
                          handlePgnDecompile(res);
                        };
                        reader.readAsText(file);
                      }
                    }}
                  />
                </label>
              </div>

              <div className="flex gap-2">
                <button
                  className="px-4 py-2 border dark:border-gray-700 rounded-md text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800"
                  onClick={() => setShowPgnModal(false)}
                >
                  Cancel
                </button>
                <button
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium"
                  onClick={() => handlePgnDecompile()}
                >
                  ⚡ Decompile & Build
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
