'use client';

import { useState, useEffect, useRef } from 'react';
import { Chess } from 'chess.js';
import { useEngine } from '@/hooks/useEngine';
import { fetchChesscomGames } from '@/lib/api';
import { parseGamesToTree, RepertoireNode } from '@/lib/repertoire';

const TreeNode = ({ 
  node, 
  depth = 0, 
  playMove, 
  onHover, 
  onLeave 
}: { 
  node: RepertoireNode, 
  depth?: number, 
  playMove: (fen: string) => void,
  onHover: (fen: string) => void,
  onLeave: () => void
}) => {
  const [isOpen, setIsOpen] = useState(depth < 2);

  return (
    <div className="ml-4 mt-1 border-l-2 border-gray-300 dark:border-gray-600 pl-3 py-1 text-sm">
      <div 
        className="flex items-center justify-between gap-4 hover:bg-gray-100 dark:hover:bg-gray-800 p-1 rounded transition-colors"
        onMouseEnter={() => onHover(node.fen)}
        onMouseLeave={onLeave}
      >
        <div className="flex items-center gap-2">
          {node.children && node.children.length > 0 ? (
            <button 
              onClick={() => setIsOpen(!isOpen)} 
              className="w-4 h-4 flex items-center justify-center bg-gray-200 dark:bg-gray-700 rounded text-xs font-bold hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              {isOpen ? '-' : '+'}
            </button>
          ) : (
            <div className="w-4 h-4" />
          )}
          <span className="font-semibold">{node.san}</span>
          <span className="text-xs px-2 py-0.5 bg-gray-200 dark:bg-gray-700 rounded-full text-gray-700 dark:text-gray-300">
            {node.count}x
          </span>
        </div>
        <button onClick={() => playMove(node.fen)} className="text-xs font-bold text-blue-500 hover:underline px-2 py-1">
          Play
        </button>
      </div>
      {isOpen && node.children && (
        <div className="mt-1">
          {node.children.map(child => (
            <TreeNode key={child.fen + child.san} node={child} depth={depth + 1} playMove={playMove} onHover={onHover} onLeave={onLeave} />
          ))}
        </div>
      )}
    </div>
  );
};

export default function Home() {
  const [game, setGame] = useState(new Chess());
  const [username, setUsername] = useState('');
  const [status, setStatus] = useState('');
  // --- REPERTOIRE TREE ---
  const [repertoire, setRepertoire] = useState<RepertoireNode[]>([]);
  const [maiaRating, setMaiaRating] = useState('1500');
  const [previewFen, setPreviewFen] = useState<string | null>(null);
  const { isReady, evaluatePosition } = useEngine();

  useEffect(() => {
    const savedPgn = localStorage.getItem('chessApp_pgn');
    const savedUser = localStorage.getItem('chessApp_username');
    if (savedPgn && savedUser) {
      setUsername(savedUser);
      try {
        const tree = parseGamesToTree(savedPgn, 30);
        setRepertoire(tree);
        setStatus(`Loaded cached repertoire for ${savedUser}`);
      } catch (e) {
        console.error('Failed to parse cached PGN');
      }
    }
  }, []);
  
  const handleFetch = async () => {
    if (!username) return;
    setStatus('Fetching games... (Waiting 1-10s to avoid rate limit)');
    try {
      const pgn = await fetchChesscomGames(username, 15);
      localStorage.setItem('chessApp_pgn', pgn);
      localStorage.setItem('chessApp_username', username);
      
      setStatus('Games fetched successfully! Parsing full tree...');
      const tree = parseGamesToTree(pgn, 30); // 15 moves deep
      setRepertoire(tree);
      setStatus(`Repertoire tree generated for ${username}!`);
    } catch (err) {
      console.error(err);
      setStatus('Error fetching games.');
    }
  };

  const handleEvaluate = async () => {
    setStatus('Evaluating with Stockfish...');
    const bestMove = await evaluatePosition(previewFen || game.fen());
    setStatus(`Stockfish best move: ${bestMove}`);
  };

  const handleMaia = async () => {
    setStatus(`Asking Maia (${maiaRating})...`);
    try {
      const response = await fetch('/api/maia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fen: previewFen || game.fen(), rating: maiaRating })
      });
      const data = await response.json();
      
      if (data.bestMove) {
        setStatus(`Maia's human move: ${data.bestMove}`);
        const from = data.bestMove.substring(0, 2);
        const to = data.bestMove.substring(2, 4);
        const promotion = data.bestMove.length > 4 ? data.bestMove.substring(4, 5) : 'q';
        
        const gameCopy = new Chess(previewFen || game.fen());
        try {
          const move = gameCopy.move({ from, to, promotion });
          if (move) {
            setGame(gameCopy);
            setPreviewFen(null);
            checkGameOver(gameCopy);
          }
        } catch {
          setStatus(`Maia error: Invalid move ${from}${to}`);
        }
      } else {
        setStatus(`Maia error: ${data.error || 'Unknown error'}`);
      }
    } catch (err) {
      setStatus('Failed to connect to Maia backend.');
    }
  };

  const [moveFrom, setMoveFrom] = useState('');
  const [optionSquares, setOptionSquares] = useState({});
  const [rightClickedSquares, setRightClickedSquares] = useState({});

  const gameRef = useRef(game);
  useEffect(() => {
    gameRef.current = game;
  }, [game]);

  // Custom 64-square board implementation
  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const rows = ['8', '7', '6', '5', '4', '3', '2', '1'];
  
  const pieceSvg: any = {
    'w': {
      'p': "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0NSA0NSIgd2lkdGg9IjQ1IiBoZWlnaHQ9IjQ1Ij48cGF0aCBkPSJNMjIuNSA5Yy0yLjIxIDAtNCAxLjc5LTQgNCAwIC44OS4yOSAxLjcxLjc4IDIuMzhDMTcuMzMgMTYuNSAxNiAxOC41OSAxNiAyMWMwIDIuMDMuOTQgMy44NCAyLjQxIDUuMDMtMyAxLjA2LTcuNDEgNS41NS03LjQxIDEzLjQ3aDIzYzAtNy45Mi00LjQxLTEyLjQxLTcuNDEtMTMuNDcgMS40Ny0xLjE5IDIuNDEtMyAyLjQxLTUuMDMgMC0yLjQxLTEuMzMtNC41LTMuMjgtNS42Mi40OS0uNjcuNzgtMS40OS43OC0yLjM4IDAtMi4yMS0xLjc5LTQtNC00eiIgZmlsbD0iI2ZmZiIgc3Ryb2tlPSIjMDAwIiBzdHJva2Utd2lkdGg9IjEuNSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+PC9zdmc+",
      'n': "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0NSA0NSIgd2lkdGg9IjQ1IiBoZWlnaHQ9IjQ1Ij48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiIHN0cm9rZT0iIzAwMCIgc3Ryb2tlLXdpZHRoPSIxLjUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBhdGggZD0iTTIyIDEwYzEwLjUgMSAxNi41IDggMTYgMjlIMTVjMC05IDEwLTYuNSA4LTIxIiBmaWxsPSIjZmZmIi8+PHBhdGggZD0iTTI0IDE4Yy4zOCAyLjkxLTUuNTUgNy4zNy04IDktMyAyLTIuODIgNC4zNC01IDQtMS4wNDItLjk0IDEuNDEtMy4wNCAwLTMtMSAwIC4xOSAxLjIzLTEgMi0xIDAtNC4wMDMgMS00LTQgMC0yIDYtMTIgNi0xMnMxLjg5LTEuOSAyLTMuNWMtLjczLS45OTQtLjUtMi0uNS0zIDEtMSAzIDIuNSAzIDIuNWgycy43OC0xLjk5MiAyLjUtM2MxIDAgMSAzIDEgMyIgZmlsbD0iI2ZmZiIvPjxwYXRoIGQ9Ik05LjUgMjUuNWEuNS41IDAgMSAxLTEgMCAuNS41IDAgMSAxIDEgMHptNS40MzMtOS43NWEuNSAxLjUgMzAgMSAxLS44NjYtLjUuNSAxLjUgMzAgMSAxIC44NjYuNXoiIGZpbGw9IiMwMDAiLz48L2c+PC9zdmc+",
      'b': "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0NSA0NSIgd2lkdGg9IjQ1IiBoZWlnaHQ9IjQ1Ij48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiIHN0cm9rZT0iIzAwMCIgc3Ryb2tlLXdpZHRoPSIxLjUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PGcgZmlsbD0iI2ZmZiIgc3Ryb2tlLWxpbmVjYXA9ImJ1dHQiPjxwYXRoIGQ9Ik05IDM2YzMuMzktLjk3IDEwLjExLjQzIDEzLjUtMiAzLjM5IDIuNDMgMTAuMTEgMS4wMyAxMy41IDIgMCAwIDEuNjUuNTQgMyAyLS42OC45Ny0xLjY1Ljk5LTMgLjUtMy4zOS0uOTctMTAuMTEuNDYtMTMuNS0xLTMuMzkgMS40Ni0xMC4xMS4wMy0xMy41IDEtMS4zNTQuNDktMi4zMjMuNDctMy0uNSAxLjM1NC0xLjk0IDMtMiAzLTJ6Ii8+PHBhdGggZD0iTTE1IDMyYzIuNSAyLjUgMTIuNSAyLjUgMTUgMCAuNS0xLjUgMC0yIDAtMiAwLTIuNS0yLjUtNC0yLjUtNCA1LjUtMS41IDYtMTEuNS01LTE1LjUtMTEgNC0xMC41IDE0LTUgMTUuNSAwIDAtMi41IDEuNS0yLjUgNCAwIDAtLjUuNSAwIDJ6Ii8+PHBhdGggZD0iTTI1IDhhMi41IDIuNSAwIDEgMS01IDAgMi41IDIuNSAwIDEgMSA1IDB6Ii8+PC9nPjxwYXRoIGQ9Ik0xNy41IDI2aDEwTTE1IDMwaDE1bS03LjUtMTQuNXY1TTIwIDE4aDUiIHN0cm9rZT0ibWl0ZXIiIHN0cm9rZS1saW5lam9pbj0ibWl0ZXIiLz48L2c+PC9zdmc+",
      'r': "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0NSA0NSIgd2lkdGg9IjQ1IiBoZWlnaHQ9IjQ1Ij48ZyBmaWxsPSIjZmZmIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiIHN0cm9rZT0iIzAwMCIgc3Ryb2tlLXdpZHRoPSIxLjUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBhdGggZD0iTTkgMzloMjd2LTNIOXYzem0zLTN2LTRoMjF2NEgxMnoiLz48cGF0aCBkPSJNMTIgOSBoNHYyaDVWOWg1djJoNVY5aDR2NUgxMXoiIHN0cm9rZS1saW5lY2FwPSJidXR0Ii8+PHBhdGggZD0iTTM0IDE0bC0zIDNIMTRsLTMtMyIvPjxwYXRoIGQ9Ik0zMSAxN3YxMi41SDE0VjE3IiBzdHJva2UtbGluZWNhcD0iYnV0dCIgc3Ryb2tlLWxpbmVqb2luPSJtaXRlciIvPjxwYXRoIGQ9Ik0zMSAyOS41bDEuNSAyLjVoLTIwbDEuNS0yLjUiLz48cGF0aCBkPSJNMTEgMTRoMjMiIGZpbGw9Im5vbmUiIHN0cm9rZS1saW5lam9pbj0ibWl0ZXIiLz48L2c+PC9zdmc+",
      'q': "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0NSA0NSIgd2lkdGg9IjQ1IiBoZWlnaHQ9IjQ1Ij48ZyBmaWxsPSIjZmZmIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiIHN0cm9rZT0iIzAwMCIgc3Ryb2tlLXdpZHRoPSIxLjUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBhdGggZD0iTTggMTJhMiAyIDAgMSAxLTQgMCAyIDIgMCAxIDEgNCAwem0xNi41LTQuNWEyIDIgMCAxIDEtNCAwIDIgMiAwIDEgMSA0IDB6TTQxIDEyYTIgMiAwIDEgMS00IDAgMiAyIDAgMSAxIDQgMHpNMTYgOC41YTIgMiAwIDEgMS00IDAgMiAyIDAgMSAxIDQgMHpNMzMgOWEyIDIgMCAxIDEtNCAwIDIgMiAwIDEgMSA0IDB6Ii8+PHBhdGggZD0iTTkgMjZjOC41LTEuNSAyMS0xLjUgMjcgMGwyLTEyLTcgMTFWMTFsLTUuNSAxMy41LTMtMTUtMyAxNS01LjUtMTRWMjVMNyAxNGwyIDEyeiIgc3Ryb2tlLWxpbmVjYXA9ImJ1dHQiLz48cGF0aCBkPSJNOSAyNmMwIDIgMS41IDIgMi41IDQgMSAxLjUgMSAxIC41IDMuNS0xLjUgMS0xLjUgMi41LTEuNSAyLjUtMS41IDEuNS41IDIuNS41IDIuNSA2LjUgMSAxNi41IDEgMjMgMCAwIDAgMS41LTEgMC0yLjUgMCAwIC41LTEuNS0xLTIuNS0uNS0yLjUtLjUtMiAuNS0zLjUgMS0yIDIuNS0yIDIuNS00LTguNS0xLjUtMTguNS0xLjUtMjcgMHoiIHN0cm9rZS1saW5lY2FwPSJidXR0Ii8+PHBhdGggZD0iTTExLjUgMzBjMy41LTEgMTguNS0xIDIyIDBNMTIgMzMuNWM2LTEgMTUtMSAyMSAwIiBmaWxsPSJub25lIi8+PC9nPjwvc3ZnPg==",
      'k': "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0NSA0NSIgd2lkdGg9IjQ1IiBoZWlnaHQ9IjQ1Ij48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiIHN0cm9rZT0iIzAwMCIgc3Ryb2tlLXdpZHRoPSIxLjUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBhdGggZD0iTTIyLjUgMTEuNjNWNk0yMCA4aDUiIHN0cm9rZS1saW5lam9pbj0ibWl0ZXIiLz48cGF0aCBkPSJNMjIuNSAyNXM0LjUtNy41IDMtMTAuNWMwIDAtMS0yLjUtMy0yLjVzLTMgMi41LTMgMi41Yy0xLjUgMyAzIDEwLjUgMyAxMC41IiBmaWxsPSIjZmZmIiBzdHJva2UtbGluZWNhcD0iYnV0dCIgc3Ryb2tlLWxpbmVqb2luPSJtaXRlciIvPjxwYXRoIGQ9Ik0xMS41IDM3YzUuNSAzLjUgMTUuNSAzLjUgMjEgMHYtN3M5LTQuNSA2LTEwLjVjLTQtNi41LTEzLjUtMy41LTE2IDRWMjd2LTMuNWMtMy41LTcuNS0xMy0xMC41LTE2LTQtMyA2IDUgMTAgNSAxMFYzN3oiIGZpbGw9IiNmZmYiLz48cGF0aCBkPSJNMExLjUgMzBjNS41LTMgMTUuNS0zIDIxIDBtLTIxIDMuNWM1LjUtMyAxNS41LTMgMjEgMG0tMjEgMy41YzUuNS0zIDE1LjUtMyAyMSAwIi8+PC9nPjwvc3ZnPg=="
    },
    'b': {
      'p': "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0NSA0NSIgd2lkdGg9IjQ1IiBoZWlnaHQ9IjQ1Ij48cGF0aCBkPSJNMjIuNSA5Yy0yLjIxIDAtNCAxLjc5LTQgNCAwIC44OS4yOSAxLjcxLjc4IDIuMzhDMTcuMzMgMTYuNSAxNiAxOC41OSAxNiAyMWMwIDIuMDMuOTQgMy44NCAyLjQxIDUuMDMtMyAxLjA2LTcuNDEgNS41NS03LjQxIDEzLjQ3aDIzYzAtNy45Mi00LjQxLTEyLjQxLTcuNDEtMTMuNDcgMS40Ny0xLjE5IDIuNDEtMyAyLjQxLTUuMDMgMC0yLjQxLTEuMzMtNC41LTMuMjgtNS42Mi40OS0uNjcuNzgtMS40OS43OC0yLjM4IDAtMi4yMS0xLjc5LTQtNC00eiIgZmlsbD0iIzAwMCIgc3Ryb2tlPSIjMDAwIiBzdHJva2Utd2lkdGg9IjEuNSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+PHBhdGggZD0iTTIyLjUgMTBjLTEuNjUgMC0zIDEuMzQtMyAzIDAgLjY3LjIyIDEuMjguNTkgMS43OC4zNi40OS44IDEuMTMuOTEgMi4yMi4xMSAxLjA4LS4yMiAyLS45MSAyLjY5QzE4LjY3IDIxLjExIDE3LjUgMjIuODkgMTcuNSAyNWMwIDEuNTIuNyAyLjg4IDEuOCAzLjc3LTIuMjUuOC01LjU1IDQuMTYtNS41NSAxMC4xaDE3LjVjMC01Ljk0LTMuMy05LjMtNS41NS0xMC4xIDEuMS0uODkgMS44LTIuMjUgMS44LTMuNzcgMC0yLjExLTEuMTctMy44OS0yLjU5LTUuMzEtLjY5LS42OS0xLjAyLTEuNjEtLjkxLTIuNjkuMTEtMS4wOS41NS0xLjczLjkxLTIuMjIuMzctLjUuNTktMS4xMS41OS0xLjc4IDAtMS42Ni0xLjM1LTMtMy0zeiIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZmZmIiBzdHJva2Utd2lkdGg9IjAuNzUiIG9wYWNpdHk9IjAuMzUiLz48L3N2Zz4=",
      'n': "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0NSA0NSIgd2lkdGg9IjQ1IiBoZWlnaHQ9IjQ1Ij48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiIHN0cm9rZT0iIzAwMCIgc3Ryb2tlLXdpZHRoPSIxLjUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBhdGggZD0iTTIyIDEwYzEwLjUgMSAxNi41IDggMTYgMjlIMTVjMC05IDEwLTYuNSA4LTIxIiBmaWxsPSIjMDAwIi8+PHBhdGggZD0iTTI0IDE4Yy4zOCAyLjkxLTUuNTUgNy4zNy04IDktMyAyLTIuODIgNC4zNC01IDQtMS4wNDItLjk0IDEuNDEtMy4wNCAwLTMtMSAwIC4xOSAxLjIzLTEgMi0xIDAtNC4wMDMgMS00LTQgMC0yIDYtMTIgNi0xMnMxLjg5LTEuOSAyLTMuNWMtLjczLS45OTQtLjUtMi0uNS0zIDEtMSAzIDIuNSAzIDIuNWgycy43OC0xLjk5MiAyLjUtM2MxIDAgMSAzIDEgMyIgZmlsbD0iIzAwMCIvPjxwYXRoIGQ9Ik05LjUgMjUuNWEuNS41IDAgMSAxLTEgMCAuNS41IDAgMSAxIDEgMHptNS40MzMtOS43NWEuNSAxLjUgMzAgMSAxLS44NjYtLjUuNSAxLjUgMzAgMSAxIC44NjYuNXoiIGZpbGw9IiNlY2VjZWMiIHN0cm9rZT0iI2VjZWNlYyIvPjxwYXRoIGQ9Ik0yNC41NSAxMC40bC0uNDUgMS40NS41LjE1YzMuMTUgMSA1LjY1IDIuNDkgNy45IDYuNzVTMzUuNzUgMjkuMDYgMzUuMjUgMzlsLS4wNS41aDIuMjVsLjA1LS41Yy41LTEwLjA2LS44OC0xNi44NS0zLjI1LTIxLjM0LTIuMzctNC40OS01Ljc5LTYuNjQtOS4xOS03LjE2bC0uNTEtLjF6IiBmaWxsPSIjZWNlY2VjIiBzdHJva2U9Im5vbmUiLz48L2c+PC9zdmc+",
      'b': "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0NSA0NSIgd2lkdGg9IjQ1IiBoZWlnaHQ9IjQ1Ij48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiIHN0cm9rZT0iIzAwMCIgc3Ryb2tlLXdpZHRoPSIxLjUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PGcgZmlsbD0iIzAwMCIgc3Ryb2tlLWxpbmVjYXA9ImJ1dHQiPjxwYXRoIGQ9Ik05IDM2YzMuMzktLjk3IDEwLjExLjQzIDEzLjUtMiAzLjM5IDIuNDMgMTAuMTEgMS4wMyAxMy41IDIgMCAwIDEuNjUuNTQgMyAyLS42OC45Ny0xLjY1Ljk5LTMgLjUtMy4zOS0uOTctMTAuMTEuNDYtMTMuNS0xLTMuMzkgMS40Ni0xMC4xMS4wMy0xMy41IDEtMS4zNTQuNDktMi4zMjMuNDctMy0uNSAxLjM1NC0xLjk0IDMtMiAzLTJ6Ii8+PHBhdGggZD0iTTE1IDMyYzIuNSAyLjUgMTIuNSAyLjUgMTUgMCAuNS0xLjUgMC0yIDAtMiAwLTIuNS0yLjUtNC0yLjUtNCA1LjUtMS41IDYtMTEuNS01LTE1LjUtMTEgNC0xMC41IDE0LTUgMTUuNSAwIDAtMi41IDEuNS0yLjUgNCAwIDAtLjUuNSAwIDJ6Ii8+PHBhdGggZD0iTTI1IDhhMi41IDIuNSAwIDEgMS01IDAgMi41IDIuNSAwIDEgMSA1IDB6Ii8+PC9nPjxwYXRoIGQ9Ik0xNy41IDI2aDEwTTE1IDMwaDE1bS03LjUtMTQuNXY1TTIwIDE4aDUiIHN0cm9rZT0iI2VjZWNlYyIgc3Ryb2tlLWxpbmVqb2luPSJtaXRlciIvPjwvZz48L3N2Zz4=",
      'r': "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0NSA0NSIgd2lkdGg9IjQ1IiBoZWlnaHQ9IjQ1Ij48ZyBmaWxsPSIjMDAwIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiIHN0cm9rZT0iIzAwMCIgc3Ryb2tlLXdpZHRoPSIxLjUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBhdGggZD0iTTkgMzloMjd2LTNIOXYzem0zLjUtN2wxLjUtMi41aDE3bDEuNSAyLjVoLTIwem0tLjUgNHYtNGgyMXY0SDEyeiIgc3Ryb2tlLWxpbmVjYXA9ImJ1dHQiLz48cGF0aCBkPSJNMTEgOXY1aDR2LTJoNXYyaDV2LTJoNXYyaDRWOUgxMXoiIHN0cm9rZS1saW5lY2FwPSJidXR0IiBzdHJva2UtbGluZWpvaW49Im1pdGVyIi8+PHBhdGggZD0iTTE0IDI5LjV2LTEzaDE3djEzSDE0eiIgc3Ryb2tlLWxpbmVjYXA9ImJ1dHQiIHN0cm9rZS1saW5lam9pbj0ibWl0ZXIiLz48cGF0aCBkPSJNMTQgMTYuNUwxMSAxNGgyM2wtMyAyLjVIMTR6Ii8+PHBhdGggZD0iTTEyIDM1LjVoMjFtLTIwLTRoMTltLTE4LTJoMTdtLTE3LTEzaDE3TTExIDE0aDIzIiBmaWxsPSJub25lIiBzdHJva2U9IiNlY2VjZWMiIHN0cm9rZS13aWR0aD0iMSIgc3Ryb2tlLWxpbmVqb2luPSJtaXRlciIvPjwvZz48L3N2Zz4=",
      'q': "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0NSA0NSIgd2lkdGg9IjQ1IiBoZWlnaHQ9IjQ1Ij48ZyBmaWxsPSIjMDAwIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiIHN0cm9rZT0iIzAwMCIgc3Ryb2tlLXdpZHRoPSIxLjUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PGcgc3Ryb2tlPSJub25lIiBmaWxsPSIjMDAwIj48Y2lyY2xlIGN4PSI2IiBjeT0iMTIiIHI9IjIuNzUiLz48Y2lyY2xlIGN4PSIxNCIgY3k9IjkiIHI9IjIuNzUiLz48Y2lyY2xlIGN4PSIyMi41IiBjeT0iOCIgcj0iMi43NSIvPjxjaXJjbGUgY3g9IjMxIiBjeT0iOSIgcj0iMi43NSIvPjxjaXJjbGUgY3g9IjM5IiBjeT0iMTIiIHI9IjIuNzUiLz48L2c+PHBhdGggZD0iTTkgMjZjOC41LTEuNSAyMS0xLjUgMjcgMGwyLjUtMTIuNUwzMSAyNWwtLjMtMTQuMS01LjIgMTMuNi0zLTE0LjUtMyAxNC41LTUuMi0xMy42TDE0IDI1IDYuNSAxMy41IDkgMjZ6IiBzdHJva2UtbGluZWNhcD0iYnV0dCIvPjxwYXRoIGQ9Ik05IDI2YzAgMiAxLjUgMiAyLjUgNCAxIDEuNSAxIDEgLjUgMy41LTEuNSAxLTEuNSAyLjUtMS41IDIuNS0xLjUgMS41LjUgMi41LjUgMi41IDYuNSAxIDE2LjUgMSAyMyAwIDAgMCAxLjUtMSAwLTIuNSAwIDAgLjUtMS41LTEtMi41LS41LTIuNS0uNS0yIC41LTMuNSAxLTIgMi41LTIgMi41LTQtOC41LTEuNS0xOC41LTEuNS0yNyAweiIgc3Ryb2tlLWxpbmVjYXA9ImJ1dHQiLz48Y2lyY2xlIGN4PSI2IiBjeT0iMTIiIHI9IjEuNSIgZmlsbD0iI2VjZWNlYyIgc3Ryb2tlPSJub25lIi8+PGNpcmNsZSBjeD0iMTQiIGN5PSI5IiByPSIxLjUiIGZpbGw9IiNlY2VjZWMiIHN0cm9rZT0ibm9uZSIvPjxjaXJjbGUgY3g9IjIyLjUiIGN5PSI4IiByPSIxLjUiIGZpbGw9IiNlY2VjZWMiIHN0cm9rZT0ibm9uZSIvPjxjaXJjbGUgY3g9IjMxIiBjeT0iOSIgcj0iMS41IiBmaWxsPSIjZWNlY2VjIiBzdHJva2U9Im5vbmUiLz48Y2lyY2xlIGN4PSIzOSIgY3k9IjEyIiByPSIxLjUiIGZpbGw9IiNlY2VjZWMiIHN0cm9rZT0ibm9uZSIvPjxwYXRoIGQ9Ik0xMSAzOC41YTM1IDM1IDEgMCAwIDIzIDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2VjZWNlYyIgc3Ryb2tlLXdpZHRoPSIxIi8+PHBhdGggZD0iTTExIDI5YTM1IDM1IDEgMCAxIDIzIDBtLTIxLjUgMi41aDIwbS0yMSAzYTM1IDM1IDEgMCAwIDIyIDBtLTIzIDNhMzUgMzUgMSAwIDAgMjQgMCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZWNlY2VjIi8+PC9nPjwvc3ZnPg==",
      'k': "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0NSA0NSIgd2lkdGg9IjQ1IiBoZWlnaHQ9IjQ1Ij48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiIHN0cm9rZT0iIzAwMCIgc3Ryb2tlLXdpZHRoPSIxLjUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBhdGggZD0iTTIyLjUgMTEuNjNWNk0yMCA4aDUiIHN0cm9rZS1saW5lam9pbj0ibWl0ZXIiLz48cGF0aCBkPSJNMjIuNSAyNXM0LjUtNy41IDMtMTAuNWMwIDAtMS0yLjUtMy0yLjVzLTMgMi41LTMgMi41Yy0xLjUgMyAzIDEwLjUgMyAxMC41IiBmaWxsPSIjMDAwIiBzdHJva2UtbGluZWNhcD0iYnV0dCIgc3Ryb2tlLWxpbmVqb2luPSJtaXRlciIvPjxwYXRoIGQ9Ik0xMS41IDM3YzUuNSAzLjUgMTUuNSAzLjUgMjEgMHYtN3M5LTQuNSA2LTEwLjVjLTQtNi41LTEzLjUtMy41LTE2IDRWMjd2LTMuNWMtMy41LTcuNS0xMy0xMC41LTE2LTQtMyA2IDUgMTAgNSAxMFYzN3oiIGZpbGw9IiMwMDAiLz48cGF0aCBkPSJNMTEuNSAzMGM1LjUtMyAxNS41LTMgMjEgMG0tMjEgMy41YzUuNS0zIDE1LjUtMyAyMSAwbS0yMSAzLjVjNS41LTMgMTUuNS0zIDIxIDAiIHN0cm9rZT0iI2VjZWNlYyIvPjxwYXRoIGQ9Ik0yMCA4aDUiIHN0cm9rZT0iI2VjZWNlYyIgc3Ryb2tlLWxpbmVqb2luPSJtaXRlciIvPjxwYXRoIGQ9Ik0yMi41IDZ2NS42MyIgc3Ryb2tlPSIjZWNlY2VjIiBzdHJva2UtbGluZWpvaW49Im1pdGVyIi8+PHBhdGggZD0iTTMyIDI5LjVzOC41LTQgNi4wMy05LjY1QzM0LjE1IDE0IDI1IDE4IDIyLjUgMjQuNWwuMDEgMi4xLS4wMS0yLjFDMjAgMTggOS45MDYgMTQgNi45OTcgMTkuODVjLTIuNDk3IDUuNjUgNC44NTMgOSA0Ljg1MyA5IiBzdHJva2U9IiNlY2VjZWMiLz48L2c+PC9zdmc+"
    }
  };

  const boardGame = previewFen ? new Chess(previewFen) : game;

  const handleDragStart = (e: React.DragEvent, square: string) => {
    e.dataTransfer.setData('sourceSquare', square);
    setMoveFrom(square);
    getMoveOptions(square, boardGame);
  };

  const handleDrop = (e: React.DragEvent, targetSquare: string) => {
    e.preventDefault();
    const sourceSquare = e.dataTransfer.getData('sourceSquare');
    if (sourceSquare === targetSquare) return;
    executeMove(sourceSquare, targetSquare, boardGame);
  };

  const handleSquareClick = (square: string) => {
    if (!moveFrom) {
      const piece = boardGame.get(square as any);
      if (piece) {
        setMoveFrom(square);
        getMoveOptions(square, boardGame);
      }
    } else {
      executeMove(moveFrom, square, boardGame);
    }
  };

  function getMoveOptions(square: string, currentGame: Chess) {
    const tempGame = new Chess();
    tempGame.loadPgn(currentGame.pgn());
    const moves = tempGame.moves({
      square: square as any,
      verbose: true
    }) as any[];
    if (moves.length === 0) {
      setOptionSquares({});
      return false;
    }

    const newSquares: any = {};
    moves.map((move) => {
      const destPiece = tempGame.get(move.to as any);
      const srcPiece = tempGame.get(square as any);
      
      const isCapture = destPiece && srcPiece && destPiece.color !== srcPiece.color;
      
      newSquares[move.to] = {
        background: isCapture 
          ? 'radial-gradient(transparent 0%, transparent 79%, rgba(0,0,0,0.15) 80%)'
          : 'radial-gradient(rgba(0,0,0,0.15) 22%, rgba(0, 0, 0, 0) 23%)',
        borderRadius: '50%'
      };
    });
    newSquares[square] = {
      background: 'rgba(255, 255, 0, 0.4)'
    };
    setOptionSquares(newSquares);
    return true;
  }

  const executeMove = (source: string, target: string, currentGame: Chess) => {
    const gameCopy = new Chess();
    gameCopy.loadPgn(currentGame.pgn());
    try {
      const move = gameCopy.move({ from: source, to: target, promotion: 'q' });
      if (move) {
        setGame(gameCopy);
        setMoveFrom('');
        setOptionSquares({});
        setPreviewFen(null);
        checkGameOver(gameCopy);
      }
    } catch (e) {
      console.error("Invalid move:", source, target, e);
      setMoveFrom('');
      setOptionSquares({});
    }
  };

  const playMove = (fen: string) => {
    try {
      const gameCopy = new Chess(fen);
      setGame(gameCopy);
      setPreviewFen(null);
      setMoveFrom('');
      setOptionSquares({});
      checkGameOver(gameCopy);
    } catch (e) {
      console.error("Invalid FEN:", fen);
    }
  };

  const checkGameOver = (currentGame: Chess) => {
    if (currentGame.isGameOver()) {
      if (currentGame.isCheckmate()) setStatus('Game over: Checkmate!');
      else if (currentGame.isDraw()) setStatus('Game over: Draw!');
      else if (currentGame.isStalemate()) setStatus('Game over: Stalemate!');
      else setStatus('Game over!');
    } else {
      setStatus(''); 
    }
  };

  const undoMove = () => {
    const gameCopy = new Chess();
    gameCopy.loadPgn(game.pgn());
    gameCopy.undo();
    setGame(gameCopy);
    setPreviewFen(null);
    setMoveFrom('');
    setOptionSquares({});
  };


  return (
    <main className="flex min-h-screen flex-col items-center p-12 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <div className="flex flex-col items-center mb-8 gap-3">
        <h1 className="text-4xl font-bold">Chess Repertoire & Game Review</h1>
        <div className="flex items-center gap-3">
          <a href="/review" className="text-emerald-700 dark:text-emerald-300 hover:underline font-bold bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 px-5 py-2 rounded-full shadow-sm">
            🎓 Full Game Review & Coach →
          </a>
          <a href="/builder" className="text-blue-600 hover:underline font-semibold bg-blue-100 dark:bg-blue-950/60 border border-blue-300 dark:border-blue-700 px-4 py-2 rounded-full">
            ✨ Repertoire Builder ✨
          </a>
        </div>
      </div>
      
      <div className="flex flex-col lg:flex-row gap-8 w-full max-w-7xl items-start">
        <div className="w-full max-w-[500px] lg:w-[500px] shrink-0">
          <div className="w-full aspect-square relative border-4 border-gray-800 dark:border-gray-900 shadow-xl rounded-sm">
            <div className="grid grid-cols-8 grid-rows-8 w-full h-full">
              {rows.map((row, rIndex) => (
                files.map((file, fIndex) => {
                  const square = `${file}${row}`;
                  const isDark = (rIndex + fIndex) % 2 === 1;
                  const piece = boardGame.get(square as any);
                  const isSelected = moveFrom === square;
                  const optionStyle = (optionSquares as any)[square];
                  
                  return (
                    <div 
                      key={square}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => handleDrop(e, square)}
                      onClick={() => handleSquareClick(square)}
                      className={`relative flex items-center justify-center
                        ${isSelected ? 'bg-[rgba(120,200,80,0.45)]' : isDark ? 'bg-[#b58863]' : 'bg-[#f0d9b5]'}`}
                    >
                      {optionStyle && (
                        <div className="absolute inset-0 pointer-events-none" style={optionStyle} />
                      )}
                      {piece && (
                        <img
                          draggable
                          onDragStart={(e) => handleDragStart(e, square)}
                          className="w-full h-full p-[5%] cursor-grab active:cursor-grabbing z-10 select-none"
                          src={pieceSvg[piece.color][piece.type]}
                          alt={`${piece.color} ${piece.type}`}
                        />
                      )}
                    </div>
                  );
                })
              ))}
            </div>
            {previewFen && (
              <div className="absolute -top-8 left-0 right-0 text-center text-sm text-blue-600 dark:text-blue-400 font-bold bg-white dark:bg-gray-800 rounded px-2 py-1 shadow">
                Previewing branch
              </div>
            )}
          </div>
          
          <div className="mt-4 p-4 bg-white dark:bg-gray-900 border rounded shadow-sm dark:border-gray-800">
            <h3 className="font-semibold mb-2">Engine Controls</h3>
            <div className="flex gap-2 flex-wrap mb-4">
              <button onClick={undoMove} className="bg-gray-200 dark:bg-gray-700 px-4 py-2 rounded text-sm">
                Undo Move
              </button>
              <button onClick={handleEvaluate} disabled={!isReady} className="bg-blue-600 text-white px-4 py-2 rounded text-sm disabled:opacity-50">
                Stockfish Eval
              </button>
            </div>
            
            <h3 className="font-semibold mb-2">Simulate Opponent (Maia)</h3>
            <div className="flex gap-2 mb-2">
              <select 
                value={maiaRating} 
                onChange={e => setMaiaRating(e.target.value)}
                className="border p-2 rounded dark:bg-gray-800 dark:border-gray-700 text-sm"
              >
                <option value="1100">Maia 1100 Rating</option>
                <option value="1500">Maia 1500 Rating</option>
                <option value="1900">Maia 1900 Rating</option>
              </select>
              <button onClick={handleMaia} className="bg-purple-600 text-white px-4 py-2 rounded text-sm hover:bg-purple-700">
                Play Maia Move
              </button>
            </div>
            
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Stockfish Status: {isReady ? 'Ready' : 'Loading...'}</p>
            <p className="mt-1 text-sm font-medium text-amber-600 dark:text-amber-400">{status}</p>
          </div>
        </div>
        
        <div className="flex-1 flex flex-col gap-4">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 dark:bg-gray-900 dark:border-gray-800">
            <h2 className="text-xl font-semibold mb-4">Ingestion</h2>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Chess.com Username"
                className="border p-2 rounded flex-1 dark:bg-gray-800 dark:border-gray-700"
              />
              <button onClick={handleFetch} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 whitespace-nowrap">
                Fetch Games
              </button>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 flex-1 dark:bg-gray-900 dark:border-gray-800">
            <h2 className="text-xl font-semibold mb-4">Full Repertoire Tree</h2>
            <div className="border rounded dark:border-gray-700 overflow-hidden h-[500px] overflow-y-auto bg-gray-50 dark:bg-gray-950 p-4">
              {repertoire.length > 0 ? (
                <div className="-ml-4">
                  {repertoire.map(node => (
                    <TreeNode 
                      key={node.fen + node.san} 
                      node={node} 
                      playMove={playMove} 
                      onHover={(fen) => setPreviewFen(fen)}
                      onLeave={() => setPreviewFen(null)}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500 italic mt-10">
                  Full tree will display here after fetching games.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
