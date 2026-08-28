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
      'p': "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0NSIgaGVpZ2h0PSI0NSI+PHBhdGggZD0iTTIyLjUgOWMtMi4yMSAwLTQgMS43OS00IDQgMCAuODkuMjkgMS43MS43OCAyLjM4QzE3LjMzIDE2LjUgMTYgMTguNTkgMTYgMjFjMCAyLjAzLjk0IDMuODQgMi40MSA1LjAzLTMgMS4wNi03LjQxIDUuNTUtNy40MSAxMy40N2gyM2MwLTcuOTItNC40MS0xMi40MS03LjQxLTEzLjQ3IDEuNDctMS4xOSAyLjQxLTMgMi40MS01LjAzIDAtMi40MS0xLjMzLTQuNS0zLjI4LTUuNjIuNDktLjY3Ljc4LTEuNDkuNzgtMi4zOCAwLTIuMjEtMS43OS00LTQtNHoiIGZpbGw9IiNmZmYiIHN0cm9rZT0iIzAwMCIgc3Ryb2tlLXdpZHRoPSIxLjUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPjwvc3ZnPg==", 
      'n': "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0NSIgaGVpZ2h0PSI0NSI+PGcgZmlsbD0ibm9uZSIgZmlsbC1ydWxlPSJldmVub2RkIiBzdHJva2U9IiMwMDAiIHN0cm9rZS13aWR0aD0iMS41IiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxwYXRoIGQ9Ik0yMiAxMGMxMC41IDEgMTYuNSA4IDE2IDI5SDE1YzAtOSAxMC02LjUgOC0yMSIgZmlsbD0iI2ZmZiIvPjxwYXRoIGQ9Ik0yNCAxOGMuMzggMi45MS01LjU1IDcuMzctOCA5LTMgMi0yLjgyIDQuMzQtNSA0LTEuMDQyLS45NCAxLjQxLTMuMDQgMC0zLTEgMCAuMTkgMS4yMy0xIDItMSAwLTQuMDAzIDEtNC00IDAtMiA2LTEyIDYtMTJzMS44OS0xLjkgMi0zLjVjLS43My0uOTk0LS41LTItLjUtMyAxLTEgMyAyLjUgMyAyLjVoMnMuNzgtMS45OTIgMi41LTNjMSAwIDEgMyAxIDMiIGZpbGw9IiNmZmYiLz48cGF0aCBkPSJNOS41IDI1LjVhLjUuNSAwIDEgMS0xIDAgLjUuNSAwIDEgMSAxIDB6bTUuNDMzLTkuNzVhLjUgMS41IDMwIDEgMS0uODY2LS41LjUgMS41IDMwIDEgMSAuODY2LjV6IiBmaWxsPSIjMDAwIi8+PC9nPjwvc3ZnPg==", 
      'b': "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0NSIgaGVpZ2h0PSI0NSI+PGcgZmlsbD0ibm9uZSIgZmlsbC1ydWxlPSJldmVub2RkIiBzdHJva2U9IiMwMDAiIHN0cm9rZS13aWR0aD0iMS41IiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxnIGZpbGw9IiNmZmYiIHN0cm9rZS1saW5lY2FwPSJidXR0Ij48cGF0aCBkPSJNOSAzNmMzLjM5LS45NyAxMC4xMS40MyAxMy41LTIgMy4zOSAyLjQzIDEwLjExIDEuMDMgMTMuNSAyIDAgMCAxLjY1LjU0IDMgMi0uNjguOTctMS42NS45OS0zIC41LTMuMzktLjk3LTEwLjExLjQ2LTEzLjUtMS0zLjM5IDEuNDYtMTAuMTEuMDMtMTMuNSAxLTEuMzU0LjQ5LTIuMzIzLjQ3LTMtLjUgMS4zNTQtMS45NCAzLTIgMy0yeiIvPjxwYXRoIGQ9Ik0xNSAzMmMyLjUgMi41IDEyLjUgMi41IDE1IDAgLjUtMS41IDAtMiAwLTIgMC0yLjUtMi41LTQtMi41LTQgNS41LTEuNSA2LTExLjUtNS0xNS41LTExIDQtMTAuNSAxNC01IDE1LjUgMCAwLTIuNSAxLjUtMi41IDQgMCAwLS41LjUgMCAyeiIvPjxwYXRoIGQ9Ik0yNSA4YTIuNSAyLjUgMCAxIDEtNSAwIDIuNSAyLjUgMCAxIDEgNSAweiIvPjwvZz48cGF0aCBkPSJNMTcuNSAyNmgxME0xNSAzMGgxNW0tNy41LTE0LjV2NU0yMCAxOGg1IiBzdHJva2UtbGluZWpvaW49Im1pdGVyIi8+PC9nPjwvc3ZnPg==", 
      'r': "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0NSIgaGVpZ2h0PSI0NSI+PGcgZmlsbD0iI2ZmZiIgZmlsbC1ydWxlPSJldmVub2RkIiBzdHJva2U9IiMwMDAiIHN0cm9rZS13aWR0aD0iMS41IiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxwYXRoIGQ9Ik05IDM5aDI3di0zSDl2M3ptMy0zdi00aDIxdjRIMTJ6bS0xLTIyVjloNHYyaDVWOWg1djJoNVY5aDR2NSIgc3Ryb2tlLWxpbmVjYXA9ImJ1dHQiLz48cGF0aCBkPSJNMzQgMTRsLTMgM0gxNGwtMy0zIi8+PHBhdGggZD0iTTMxIDE3djEyLjVIMTRWMTciIHN0cm9rZS1saW5lY2FwPSJidXR0IiBzdHJva2UtbGluZWpvaW49Im1pdGVyIi8+PHBhdGggZD0iTTMxIDI5LjVsMS41IDIuNWgtMjBsMS41LTIuNSIvPjxwYXRoIGQ9Ik0xMSAxNGgyMyIgZmlsbD0ibm9uZSIgc3Ryb2tlLWxpbmVqb2luPSJtaXRlciIvPjwvZz48L3N2Zz4=", 
      'q': "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0NSIgaGVpZ2h0PSI0NSI+PGcgZmlsbD0iI2ZmZiIgZmlsbC1ydWxlPSJldmVub2RkIiBzdHJva2U9IiMwMDAiIHN0cm9rZS13aWR0aD0iMS41IiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxwYXRoIGQ9Ik04IDEyYTIgMiAwIDEgMS00IDAgMiAyIDAgMSAxIDQgMHptMTYuNS00LjVhMiAyIDAgMSAxLTQgMCAyIDIgMCAxIDEgNCAwek00MSAxMmEyIDIgMCAxIDEtNCAwIDIgMiAwIDEgMSA0IDB6TTE2IDguNWEyIDIgMCAxIDEtNCAwIDIgMiAwIDEgMSA0IDB6TTMzIDlhMiAyIDAgMSAxLTQgMCAyIDIgMCAxIDEgNCAweiIvPjxwYXRoIGQ9Ik05IDI2YzguNS0xLjUgMjEtMS41IDI3IDBsMi0xMi03IDExVjExbC01LjUgMTMuNS0zLTE1LTMgMTUtNS41LTE0VjI1TDcgMTRsMiAxMnoiIHN0cm9rZS1saW5lY2FwPSJidXR0Ii8+PHBhdGggZD0iTTkgMjZjMCAyIDEuNSAyIDIuNSA0IDEgMS41IDEgMSAuNSAzLjUtMS41IDEtMS41IDIuNS0xLjUgMi41LTEuNSAxLjUuNSAyLjUuNSAyLjUgNi41IDEgMTYuNSAxIDIzIDAgMCAwIDEuNS0xIDAtMi41IDAgMCAuNS0xLjUtMS0yLjUtLjUtMi41LS41LTIgLjUtMy41IDEtMiAyLjUtMiAyLjUtNC04LjUtMS41LTE4LjUtMS41LTI3IDB6IiBzdHJva2UtbGluZWNhcD0iYnV0dCIvPjxwYXRoIGQ9Ik0xMS41IDMwYzMuNS0xIDE4LjUtMSAyMiAwTTEyIDMzLjVjNi0xIDE1LTEgMjEgMCIgZmlsbD0ibm9uZSIvPjwvZz48L3N2Zz4=", 
      'k': "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0NSIgaGVpZ2h0PSI0NSI+PGcgZmlsbD0ibm9uZSIgZmlsbC1ydWxlPSJldmVub2RkIiBzdHJva2U9IiMwMDAiIHN0cm9rZS13aWR0aD0iMS41IiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxwYXRoIGQ9Ik0yMi41IDExLjYzVjYiIHN0cm9rZS1saW5lam9pbj0ibWl0ZXIiLz48cGF0aCBkPSJNMjIuNSAyNXM0LjUtNy41IDMtMTAuNWMwIDAtMS0yLjUtMy0yLjVzLTMgMi41LTMgMi41Yy0xLjUgMyAzIDEwLjUgMyAxMC41IiBmaWxsPSIjMDAwIiBzdHJva2UtbGluZWNhcD0iYnV0dCIgc3Ryb2tlLWxpbmVqb2luPSJtaXRlciIvPjxwYXRoIGQ9Ik0xMS41IDM3YzUuNSAzLjUgMTUuNSAzLjUgMjEgMHYtN3M5LTQuNSA2LTEwLjVjLTQtNi41LTEzLjUtMy41LTE2IDRWMjd2LTMuNWMtMy41LTcuNS0xMy0xMC41LTE2LTQtMyA2IDUgMTAgNSAxMFYzN3oiIGZpbGw9IiMwMDAiLz48cGF0aCBkPSJNMjAgOGg1IiBzdHJva2UtbGluZWpvaW49Im1pdGVyIi8+PHBhdGggZD0iTTMyIDI5LjVzOC41LTQgNi4wMy05LjY1QzM0LjE1IDE0IDI1IDE4IDIyLjUgMjQuNWwuMDEgMi4xLS4wMS0yLjFDMjAgMTggOS45MDYgMTQgNi45OTcgMTkuODVjLTIuNDk3IDUuNjUgNC44NTMgOSA0Ljg1MyA5IiBzdHJva2U9IiNlY2VjZWMiLz48cGF0aCBkPSJNMTEuNSAzMGM1LjUtMyAxNS41LTMgMjEgMG0tMjEgMy41YzUuNS0zIDE1LjUtMyAyMSAwbS0yMSAzLjVjNS41LTMgMTUuNS0zIDIxIDAiIHN0cm9rZT0iI2VjZWNlYyIvPjwvZz48L3N2Zz4="
    },
    'b': { 
      'p': "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0NSIgaGVpZ2h0PSI0NSI+PHBhdGggZD0iTTIyLjUgOWMtMi4yMSAwLTQgMS43OS00IDQgMCAuODkuMjkgMS43MS43OCAyLjM4QzE3LjMzIDE2LjUgMTYgMTguNTkgMTYgMjFjMCAyLjAzLjk0IDMuODQgMi40MSA1LjAzLTMgMS4wNi03LjQxIDUuNTUtNy40MSAxMy40N2gyM2MwLTcuOTItNC40MS0xMi40MS03LjQxLTEzLjQ3IDEuNDctMS4xOSAyLjQxLTMgMi40MS01LjAzIDAtMi40MS0xLjMzLTQuNS0zLjI4LTUuNjIuNDktLjY3Ljc4LTEuNDkuNzgtMi4zOCAwLTIuMjEtMS43OS00LTQtNHoiIHN0cm9rZT0iIzAwMCIgc3Ryb2tlLXdpZHRoPSIxLjUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPjwvc3ZnPg==", 
      'n': "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0NSIgaGVpZ2h0PSI0NSI+PGcgZmlsbD0ibm9uZSIgZmlsbC1ydWxlPSJldmVub2RkIiBzdHJva2U9IiMwMDAiIHN0cm9rZS13aWR0aD0iMS41IiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxwYXRoIGQ9Ik0yMiAxMGMxMC41IDEgMTYuNSA4IDE2IDI5SDE1YzAtOSAxMC02LjUgOC0yMSIgZmlsbD0iIzAwMCIvPjxwYXRoIGQ9Ik0yNCAxOGMuMzggMi45MS01LjU1IDcuMzctOCA5LTMgMi0yLjgyIDQuMzQtNSA0LTEuMDQyLS45NCAxLjQxLTMuMDQgMC0zLTEgMCAuMTkgMS4yMy0xIDItMSAwLTQuMDAzIDEtNC00IDAtMiA2LTEyIDYtMTJzMS44OS0xLjkgMi0zLjVjLS43My0uOTk0LS41LTItLjUtMyAxLTEgMyAyLjUgMyAyLjVoMnMuNzgtMS45OTIgMi41LTNjMSAwIDEgMyAxIDMiIGZpbGw9IiMwMDAiLz48cGF0aCBkPSJNOS41IDI1LjVhLjUuNSAwIDEgMS0xIDAgLjUuNSAwIDEgMSAxIDB6bTUuNDMzLTkuNzVhLjUgMS41IDMwIDEgMS0uODY2LS41LjUgMS41IDMwIDEgMSAuODY2LjV6IiBmaWxsPSIjZWNlY2VjIiBzdHJva2U9IiNlY2VjZWMiLz48cGF0aCBkPSJNMjQuNTUgMTAuNGwtLjQ1IDEuNDUuNS4xNWMzLjE1IDEgNS42NSAyLjQ5IDcuOSA2Ljc1UzM1Ljc1IDI5LjA2IDM1LjI1IDM5bC0uMDUuNWgyLjI1bC4wNS0uNWMuNS0xMC4wNi0uODgtMTYuODUtMy4yNS0yMS4zNC0yLjM3LTQuNDktNS43OS02LjY0LTkuMTktNy4xNmwtLjUxLS4xeiIgZmlsbD0iI2VjZWNlYyIgc3Ryb2tlPSJub25lIi8+PC9nPjwvc3ZnPg==", 
      'b': "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0NSIgaGVpZ2h0PSI0NSI+PGcgZmlsbD0ibm9uZSIgZmlsbC1ydWxlPSJldmVub2RkIiBzdHJva2U9IiMwMDAiIHN0cm9rZS13aWR0aD0iMS41IiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxnIGZpbGw9IiMwMDAiIHN0cm9rZS1saW5lY2FwPSJidXR0Ij48cGF0aCBkPSJNOSAzNmMzLjM5LS45NyAxMC4xMS40MyAxMy41LTIgMy4zOSAyLjQzIDEwLjExIDEuMDMgMTMuNSAyIDAgMCAxLjY1LjU0IDMgMi0uNjguOTctMS42NS45OS0zIC41LTMuMzktLjk3LTEwLjExLjQ2LTEzLjUtMS0zLjM5IDEuNDYtMTAuMTEuMDMtMTMuNSAxLTEuMzU0LjQ5LTIuMzIzLjQ3LTMtLjUgMS4zNTQtMS45NCAzLTIgMy0yeiIvPjxwYXRoIGQ9Ik0xNSAzMmMyLjUgMi41IDEyLjUgMi41IDE1IDAgLjUtMS41IDAtMiAwLTIgMC0yLjUtMi41LTQtMi41LTQgNS41LTEuNSA2LTExLjUtNS0xNS41LTExIDQtMTAuNSAxNC01IDE1LjUgMCAwLTIuNSAxLjUtMi41IDQgMCAwLS41LjUgMCAyeiIvPjxwYXRoIGQ9Ik0yNSA4YTIuNSAyLjUgMCAxIDEtNSAwIDIuNSAyLjUgMCAxIDEgNSAweiIvPjwvZz48cGF0aCBkPSJNMTcuNSAyNmgxME0xNSAzMGgxNW0tNy41LTE0LjV2NU0yMCAxOGg1IiBzdHJva2U9IiNlY2VjZWMiIHN0cm9rZS1saW5lam9pbj0ibWl0ZXIiLz48L2c+PC9zdmc+", 
      'r': "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0NSIgaGVpZ2h0PSI0NSI+PGcgZmlsbC1ydWxlPSJldmVub2RkIiBzdHJva2U9IiMwMDAiIHN0cm9rZS13aWR0aD0iMS41IiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxwYXRoIGQ9Ik05IDM5aDI3di0zSDl2M3ptMy41LTdsMS41LTIuNWgxN2wxLjUgMi41aC0yMHptLS41IDR2LTRoMjF2NEgxMnoiIHN0cm9rZS1saW5lY2FwPSJidXR0Ii8+PHBhdGggZD0iTTE0IDI5LjV2LTEzaDE3djEzSDE0eiIgc3Ryb2tlLWxpbmVjYXA9ImJ1dHQiIHN0cm9rZS1saW5lam9pbj0ibWl0ZXIiLz48cGF0aCBkPSJNMTQgMTYuNUwxMSAxNGgyM2wtMyAyLjVIMTR6TTExIDE0VjloNHYyaDVWOWg1djJoNVY5aDR2NUgxMXoiIHN0cm9rZS1saW5lY2FwPSJidXR0Ii8+PHBhdGggZD0iTTEyIDM1LjVoMjFtLTIwLTRoMTltLTE4LTJoMTdtLTE3LTEzaDE3TTExIDE0aDIzIiBmaWxsPSJub25lIiBzdHJva2U9IiNlY2VjZWMiIHN0cm9rZS13aWR0aD0iMSIgc3Ryb2tlLWxpbmVqb2luPSJtaXRlciIvPjwvZz48L3N2Zz4=", 
      'k': "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0NSIgaGVpZ2h0PSI0NSI+PGcgZmlsbD0ibm9uZSIgZmlsbC1ydWxlPSJldmVub2RkIiBzdHJva2U9IiMwMDAiIHN0cm9rZS13aWR0aD0iMS41IiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxwYXRoIGQ9Ik0yMi41IDExLjYzVjYiIHN0cm9rZS1saW5lam9pbj0ibWl0ZXIiLz48cGF0aCBkPSJNMjIuNSAyNXM0LjUtNy41IDMtMTAuNWMwIDAtMS0yLjUtMy0yLjVzLTMgMi41LTMgMi41Yy0xLjUgMyAzIDEwLjUgMyAxMC41IiBmaWxsPSIjMDAwIiBzdHJva2UtbGluZWNhcD0iYnV0dCIgc3Ryb2tlLWxpbmVqb2luPSJtaXRlciIvPjxwYXRoIGQ9Ik0xMS41IDM3YzUuNSAzLjUgMTUuNSAzLjUgMjEgMHYtN3M5LTQuNSA2LTEwLjVjLTQtNi41LTEzLjUtMy41LTE2IDRWMjd2LTMuNWMtMy41LTcuNS0xMy0xMC41LTE2LTQtMyA2IDUgMTAgNSAxMFYzN3oiIGZpbGw9IiMwMDAiLz48cGF0aCBkPSJNMjAgOGg1IiBzdHJva2UtbGluZWpvaW49Im1pdGVyIi8+PHBhdGggZD0iTTMyIDI5LjVzOC41LTQgNi4wMy05LjY1QzM0LjE1IDE0IDI1IDE4IDIyLjUgMjQuNWwuMDEgMi4xLS4wMS0yLjFDMjAgMTggOS45MDYgMTQgNi45OTcgMTkuODVjLTIuNDk3IDUuNjUgNC44NTMgOSA0Ljg1MyA5IiBzdHJva2U9IiNlY2VjZWMiLz48cGF0aCBkPSJNMTEuNSAzMGM1LjUtMyAxNS41LTMgMjEgMG0tMjEgMy41YzUuNS0zIDE1LjUtMyAyMSAwbS0yMSAzLjVjNS41LTMgMTUuNS0zIDIxIDAiIHN0cm9rZT0iI2VjZWNlYyIvPjwvZz48L3N2Zz4="
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
      <h1 className="text-4xl font-bold mb-8">Chess Repertoire Builder</h1>
      
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
