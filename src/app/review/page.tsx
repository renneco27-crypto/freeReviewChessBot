'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { Board } from '../../components/ChessReview/Board';
import { CoachBot } from '../../components/ChessReview/CoachBot';
import { runStockfishGameReview } from '../../lib/stockfishReview';
import { analyzePGN } from '../../lib/engineAnalyzer';
import { sounds } from '../../lib/soundService';
import type { GameReviewReport, MoveAnalysis, MoveClassification, ChessComGameSummary } from '../../types/review';
import './coach.css';

const SAMPLE_KASPAROV_PGN = `[Event "Wijk aan Zee"]
[Site "Wijk aan Zee NED"]
[Date "1999.01.20"]
[Round "4"]
[White "Garry Kasparov"]
[Black "Veselin Topalov"]
[Result "1-0"]
[ECO "B07"]
[WhiteElo "2812"]
[BlackElo "2700"]

1. e4 d6 2. d4 Nf6 3. Nc3 g6 4. Be3 Bg7 5. Qd2 c6 6. f3 b5 7. Nge2 Nbd7 8. Bh6 Bxh6 9. Qxh6 Bb7 10. a3 e5 11. O-O-O Qe7 12. Kb1 a6 13. Nc1 O-O-O 14. Nb3 exd4 15. Rxd4 c5 16. Rd1 Nb6 17. g3 Kb8 18. Na5 Ba8 19. Bh3 d5 20. Qf4+ Ka7 21. Rhe1 d4 22. Nd5 Nbxd5 23. exd5 Qd6 24. Rxd4 cxd4 25. Re7+ Kb6 26. Qxd4+ Kxa5 27. b4+ Ka4 28. Qc3 Qxd5 29. Ra7 Bb7 30. Rxb7 Qc4 31. Qxf6 Kxa3 32. Qxa6+ Kxb4 33. c3+ Kxc3 34. Qa1+ Kd2 35. Qb2+ Kd1 36. Bf1 Rd2 37. Rd7 Rxd7 38. Bxc4 bxc4 39. Qxh8 Rd3 40. Qa8 c3 41. Qa4+ Ke1 42. f4 f5 43. Kc1 Rd2 44. Qa7 1-0`;

export default function GameReviewPage() {
  const [report, setReport] = useState<GameReviewReport | null>(null);
  const [currentPly, setCurrentPly] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [engineStatus, setEngineStatus] = useState<'ready' | 'thinking' | 'error'>('ready');
  const [engineLabel, setEngineLabel] = useState('Stockfish NNUE Engine Ready');
  const [pgnInput, setPgnInput] = useState('');
  const [fenInput, setFenInput] = useState('');
  const [chessUserInput, setChessUserInput] = useState('');
  const [syncStatus, setSyncStatus] = useState('');
  const [syncGames, setSyncGames] = useState<ChessComGameSummary[]>([]);
  const [depth, setDepth] = useState(10);
  const [rating, setRating] = useState('1400');
  const [apiToken, setApiToken] = useState('');
  const [flipped, setFlipped] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [showWhyMistake, setShowWhyMistake] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const currentMove: MoveAnalysis | null = report?.moves.find(m => m.ply === currentPly) ?? null;
  const currentFen = currentPly === 0
    ? 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    : (report?.moves.find(m => m.ply === currentPly)?.fenAfter ?? 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');

  const currentEval = currentMove?.evalAfter ?? 0;
  const evalWhitePawns = currentEval / 100;
  const evalDisplay = evalWhitePawns >= 0 ? `+${evalWhitePawns.toFixed(2)}` : evalWhitePawns.toFixed(2);

  // Vertical eval bar height calculation
  const clampedCp = Math.max(-1000, Math.min(1000, currentEval));
  const evalBarHeight = `${Math.max(5, Math.min(95, 50 + (clampedCp / 1000) * 45))}%`;

  // Start analysis
  const doReview = useCallback(async (pgn: string) => {
    if (!pgn.trim()) return;
    setIsAnalyzing(true);
    setEngineStatus('thinking');
    setEngineLabel('Analyzing game with Stockfish NNUE...');
    setCurrentPly(0);

    try {
      let result: GameReviewReport;
      try {
        result = await runStockfishGameReview(pgn, (curr, tot, msg) => {
          setEngineLabel(msg);
        }, depth);
      } catch (e) {
        console.warn('Worker review fallback:', e);
        result = analyzePGN(pgn);
      }

      setReport(result);
      setEngineStatus('ready');
      setEngineLabel('Review complete · Ready');
    } catch (err) {
      setEngineStatus('error');
      setEngineLabel(`Analysis failed: ${err instanceof Error ? err.message : 'Invalid PGN'}`);
    } finally {
      setIsAnalyzing(false);
    }
  }, [depth]);

  const handleReviewClick = () => {
    const pgn = pgnInput.trim() || SAMPLE_KASPAROV_PGN;
    doReview(pgn);
  };

  const handleClearClick = () => {
    setPgnInput('');
    setReport(null);
    setCurrentPly(0);
    setEngineLabel('Stockfish NNUE Engine Ready');
  };

  const handleSyncChessCom = async () => {
    if (!chessUserInput.trim()) return;
    setSyncStatus('Fetching recent games from Chess.com...');
    try {
      const res = await fetch(`https://api.chess.com/pub/player/${chessUserInput.toLowerCase().trim()}/games/archives`);
      if (!res.ok) throw new Error('Player not found');
      const data = await res.json();
      const archives = data.archives || [];
      if (!archives.length) throw new Error('No archives found');

      const latest = archives[archives.length - 1];
      const gRes = await fetch(latest);
      const gData = await gRes.json();
      const games: ChessComGameSummary[] = (gData.games || []).filter((g: any) => g.rules === 'chess').reverse();

      setSyncGames(games);
      setSyncStatus(`Found ${games.length} games`);
    } catch (e) {
      setSyncStatus(`Sync error: ${e instanceof Error ? e.message : 'Unknown'}`);
    }
  };

  const navigateMove = useCallback((direction: 'prev' | 'next') => {
    if (!report) return;
    const maxPly = report.moves.length;
    setCurrentPly(prev => {
      let next = prev;
      if (direction === 'prev') next = Math.max(0, prev - 1);
      if (direction === 'next') next = Math.min(maxPly, prev + 1);

      if (next !== prev && next > 0) {
        const move = report.moves[next - 1];
        if (move?.san.includes('x')) sounds.playCapture();
        else if (move?.san.includes('+') || move?.san.includes('#')) sounds.playCheck();
        else if (move?.classification === 'brilliant') sounds.playBrilliant();
        else if (move?.classification === 'blunder') sounds.playBlunder();
        else sounds.playMove();

        setShowWhyMistake(move?.classification === 'blunder' || move?.classification === 'mistake');
      }
      return next;
    });
  }, [report]);

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (['input', 'textarea'].includes((e.target as HTMLElement).tagName.toLowerCase())) return;
      if (e.key === 'ArrowLeft') navigateMove('prev');
      if (e.key === 'ArrowRight') navigateMove('next');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigateMove]);

  // Draw Evaluation Canvas Graph
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !report) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = (canvas.width = canvas.parentElement?.clientWidth || 300);
    const h = (canvas.height = 64);

    ctx.clearRect(0, 0, w, h);

    const evals = [0, ...report.moves.map(m => Math.max(-600, Math.min(600, m.evalAfter)) / 100)];
    const pts = evals.map((val, i) => {
      const x = (i / Math.max(evals.length - 1, 1)) * w;
      const y = h / 2 - (val / 6) * (h / 2 - 4);
      return { x, y };
    });

    // Zero baseline
    ctx.strokeStyle = '#3a332a';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Curve
    ctx.strokeStyle = '#3d8b5c';
    ctx.lineWidth = 2;
    ctx.beginPath();
    pts.forEach((p, i) => {
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();

    // Active Move indicator
    if (currentPly >= 0 && currentPly < pts.length) {
      const cur = pts[currentPly];
      ctx.strokeStyle = '#c8a84b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cur.x, 0);
      ctx.lineTo(cur.x, h);
      ctx.stroke();

      ctx.fillStyle = '#c8a84b';
      ctx.beginPath();
      ctx.arc(cur.x, cur.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [report, currentPly]);

  // Coach message calculation
  let coachMood: MoveClassification | 'ready' | 'thinking' = 'ready';
  let coachMessage = 'Ready when you are. Make a move or paste a PGN to review a game.';

  if (isAnalyzing) {
    coachMood = 'thinking';
    coachMessage = engineLabel;
  } else if (currentMove) {
    coachMood = currentMove.classification;
    if (coachMood === 'brilliant') {
      coachMessage = `Brilliant move! This finds a remarkable tactical resource that completely shifts the evaluation.`;
    } else if (coachMood === 'best') {
      coachMessage = `Best move. Perfectly calculated continuation matching top engine recommendations.`;
    } else if (coachMood === 'great') {
      coachMessage = `Great move! Keeps the position firmly under control.`;
    } else if (coachMood === 'excellent' || coachMood === 'good') {
      coachMessage = `Solid play. Natural development that maintains your positional advantage.`;
    } else if (coachMood === 'book') {
      coachMessage = `Opening book move following mainline theoretical principles.`;
    } else if (coachMood === 'inaccuracy') {
      coachMessage = `A slight inaccuracy. Not a blunder, but gives your opponent some counterplay.`;
    } else if (coachMood === 'mistake') {
      coachMessage = `Mistake. This allows a tactical response that significantly weakens your position.`;
    } else if (coachMood === 'blunder') {
      coachMessage = `Blunder! This drastically throws away the evaluation and gives up a major advantage.`;
    }
  }

  return (
    <div className="coach-page">
      {/* Header */}
      <header className="coach-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Link href="/" style={{ color: 'var(--text-dim)', textDecoration: 'none', fontSize: '12px', fontWeight: 600 }}>
            ← Home
          </Link>
          <h1>
            Chess Coach <span>Coach · Stockfish · NNUE</span>
          </h1>
        </div>

        <div className="rating-select-wrap">
          <label htmlFor="ratingSelect">Rating</label>
          <select id="ratingSelect" value={rating} onChange={(e) => setRating(e.target.value)}>
            <option value="1000">&lt;1200</option>
            <option value="1200">1200–1399</option>
            <option value="1400">1400–1599</option>
            <option value="1600">1600–1799</option>
            <option value="1800">1800–1999</option>
            <option value="2000">2000–2199</option>
            <option value="2200">2200–2499</option>
            <option value="2500">2500+</option>
          </select>
        </div>

        <div className="token-wrap">
          <input
            type="text"
            id="apiToken"
            value={apiToken}
            onChange={(e) => setApiToken(e.target.value)}
            placeholder="Lichess API token (optional)"
            spellCheck="false"
          />
          <button className="btn small" onClick={() => alert('Token saved')}>Save</button>
        </div>
      </header>

      <div className="main-wrap">
        {/* Board column */}
        <div className="board-col">
          <div className="board-area">
            {/* Vertical Eval Bar */}
            <div className="eval-vert">
              <span className="eval-val" id="evalDisplay">{evalDisplay}</span>
              <div className="eval-bar-wrap-v">
                <div className="eval-bar-v" id="evalBar" style={{ height: evalBarHeight }} />
              </div>
            </div>

            {/* Chessboard Area */}
            <div className="board-wrap">
              <Board fen={currentFen} currentMove={currentMove} flipped={flipped} />
            </div>
          </div>

          {/* FEN row */}
          <div className="fen-row">
            <input
              className="fen-input"
              value={fenInput}
              onChange={(e) => setFenInput(e.target.value)}
              placeholder="Paste FEN to load a position…"
              spellCheck="false"
            />
            <button className="btn primary" onClick={() => {}}>Position</button>
          </div>

          {/* PGN row */}
          <div className="pgn-row">
            <textarea
              value={pgnInput}
              onChange={(e) => setPgnInput(e.target.value)}
              placeholder="Paste PGN here to review a complete game…"
              spellCheck="false"
              rows={3}
            />
            <div className="pgn-actions">
              <button className="btn accent" onClick={handleReviewClick} disabled={isAnalyzing}>
                {isAnalyzing ? '⏳ Analyzing...' : '▶ Review Game'}
              </button>
              <button className="btn danger" onClick={handleClearClick}>Clear</button>
              <button className="btn" onClick={() => doReview(SAMPLE_KASPAROV_PGN)} style={{ fontSize: '11px' }}>
                Sample Game
              </button>
            </div>
          </div>

          {/* Move Controls */}
          <div className="move-controls">
            <div className="depth-row">
              <span>Depth</span>
              <input
                type="range"
                min="6"
                max="18"
                value={depth}
                onChange={(e) => setDepth(parseInt(e.target.value))}
              />
              <span>{depth}</span>
            </div>

            <button className="btn" onClick={() => setFlipped(!flipped)} title="Flip board">
              ↺ Flip
            </button>
            <button className="btn" onClick={() => navigateMove('prev')}>
              ← Prev
            </button>
            <button className="btn" onClick={() => navigateMove('next')}>
              Next →
            </button>
            <button
              className={`btn ${ttsEnabled ? 'tts-on' : ''}`}
              onClick={() => setTtsEnabled(!ttsEnabled)}
              title="Toggle coach voice"
            >
              {ttsEnabled ? '🔊 Voice: ON' : '🔇 Voice: OFF'}
            </button>
          </div>
        </div>

        {/* Right column */}
        <div className="right-col">
          {/* Engine Status */}
          <div className="engine-status-big">
            <div className={`engine-dot ${engineStatus}`} />
            <span>{engineLabel}</span>
          </div>

          {/* Animated Coach Bot Widget */}
          <CoachBot
            mood={coachMood}
            message={coachMessage}
            san={currentMove?.san}
            ttsEnabled={ttsEnabled}
            showWhyMistake={showWhyMistake}
            onWhyMistake={() => alert(`Refutation line: ${currentMove?.bestMoveUci || 'Engine suggests defending or retreating the attacked piece.'}`)}
          />

          {/* Eval Graph Panel */}
          <div className="graph-panel">
            <div className="panel-title">Evaluation Graph</div>
            <canvas ref={canvasRef} id="evalCanvas" />
          </div>

          {/* Chess.com Sync Panel */}
          <div className="chess-sync-panel">
            <div className="panel-title">Chess.com Sync</div>
            <div className="sync-row">
              <input
                className="sync-input"
                value={chessUserInput}
                onChange={(e) => setChessUserInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSyncChessCom()}
                placeholder="Username (e.g. magnuscarlsen)"
                spellCheck="false"
              />
              <button className="btn" onClick={handleSyncChessCom}>↺ Sync</button>
            </div>
            {syncStatus && <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '4px' }}>{syncStatus}</div>}
            {syncGames.length > 0 && (
              <div style={{ marginTop: '8px', maxHeight: '120px', overflowY: 'auto' }}>
                {syncGames.slice(0, 5).map((g, i) => (
                  <button
                    key={i}
                    onClick={() => { setPgnInput(g.pgn); doReview(g.pgn); }}
                    style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', color: 'var(--gold)', cursor: 'pointer', padding: '3px 0', fontSize: '11px' }}
                  >
                    ▶ vs {g.white.username.toLowerCase() === chessUserInput.toLowerCase() ? g.black.username : g.white.username} ({g.time_class})
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Move History Panel */}
          <div className="history-panel">
            <div className="history-header">
              <span className="panel-title" style={{ margin: 0 }}>Move History</span>
              {report && (
                <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                  W: {report.whiteAccuracy}% · B: {report.blackAccuracy}%
                </span>
              )}
            </div>

            <div className="move-list">
              {report?.moves.map((m) => (
                <div
                  key={m.ply}
                  className={`move-chip ${m.ply === currentPly ? 'active' : ''}`}
                  onClick={() => setCurrentPly(m.ply)}
                >
                  <span>{m.moveNumber}{m.color === 'w' ? '.' : '...'}</span>
                  <span>{m.san}</span>
                  <span style={{ fontSize: '10px', color: m.classification === 'blunder' ? 'var(--danger-hi)' : 'var(--gold)' }}>
                    {m.classification === 'brilliant' ? '!!' : m.classification === 'blunder' ? '??' : m.classification === 'best' ? '★' : ''}
                  </span>
                </div>
              ))}
              {!report && (
                <div style={{ fontSize: '12px', color: 'var(--text-mute)', padding: '8px 0' }}>
                  No moves loaded yet. Paste a PGN or select a sample game.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
