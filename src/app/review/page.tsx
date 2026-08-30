'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Board } from '../../components/ChessReview/Board';
import { EvalBar } from '../../components/ChessReview/EvalBar';
import { EvalGraph } from '../../components/ChessReview/EvalGraph';
import { MoveList } from '../../components/ChessReview/MoveList';
import { CoachReviewCard } from '../../components/ChessReview/CoachReviewCard';
import { AdvancedStatsModal } from '../../components/ChessReview/AdvancedStatsModal';
import { GameListModal } from '../../components/ChessReview/GameListModal';
import { analyzePGN } from '../../lib/engineAnalyzer';
import { generateGameSummary } from '../../lib/coachReviewer';
import { sounds } from '../../lib/soundService';
import type { GameReviewReport, ChessComGameSummary } from '../../types/review';

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

const SAMPLE_OPERA_PGN = `[Event "Paris Opera"]
[Site "Paris FRA"]
[Date "1858.11.02"]
[White "Paul Morphy"]
[Black "Duke Karl / Count Isouard"]
[Result "1-0"]
[ECO "C41"]

1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7 8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7 12. O-O-O Rd8 13. Rxd7 Rxd7 14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ Nxb8 17. Rd8# 1-0`;

export default function GameReviewPage() {
  const [report, setReport] = useState<GameReviewReport | null>(null);
  const [currentPly, setCurrentPly] = useState(0);
  const [showStats, setShowStats] = useState(false);
  const [showGameList, setShowGameList] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [pgnInput, setPgnInput] = useState('');
  const [username, setUsername] = useState('');
  const [games, setGames] = useState<ChessComGameSummary[]>([]);
  const [gamesLoading, setGamesLoading] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'import' | 'chesscom'>('import');
  const [gameSummary, setGameSummary] = useState('');

  const currentMove = report?.moves.find(m => m.ply === currentPly) ?? null;
  const currentFen = currentPly === 0
    ? 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    : (report?.moves.find(m => m.ply === currentPly)?.fenAfter ?? 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  const currentEval = currentMove?.evalAfter ?? 0;

  const doAnalyze = useCallback((pgn: string) => {
    setIsAnalyzing(true);
    setError('');
    setCurrentPly(0);
    try {
      const result = analyzePGN(pgn);
      setReport(result);
      setGameSummary(generateGameSummary(result));
    } catch (e) {
      setError(`Analysis failed: ${e instanceof Error ? e.message : 'Invalid PGN'}`);
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  const handleImportPGN = () => {
    const pgn = pgnInput.trim() || SAMPLE_KASPAROV_PGN;
    doAnalyze(pgn);
  };

  const handleFetchChessCom = async () => {
    if (!username.trim()) return;
    setGamesLoading(true);
    setError('');
    try {
      const archivesRes = await fetch(`https://api.chess.com/pub/player/${username.toLowerCase().trim()}/games/archives`);
      if (!archivesRes.ok) throw new Error(`Player "${username}" not found on Chess.com`);
      const archivesData = await archivesRes.json();
      const archives = archivesData.archives || [];
      if (archives.length === 0) throw new Error('No game archives found for this player');

      const latestArchiveUrl = archives[archives.length - 1];
      const gamesRes = await fetch(latestArchiveUrl);
      if (!gamesRes.ok) throw new Error('Could not retrieve monthly archive');
      const gamesData = await gamesRes.json();
      const fetchedGames: ChessComGameSummary[] = (gamesData.games || []).filter((g: any) => g.rules === 'chess').reverse();

      setGames(fetchedGames);
      setShowGameList(true);
    } catch (e) {
      setError(`Failed to fetch: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally {
      setGamesLoading(false);
    }
  };

  const handleSelectGame = (pgn: string) => {
    setShowGameList(false);
    setPgnInput(pgn);
    doAnalyze(pgn);
  };

  const navigateMove = useCallback((direction: 'prev' | 'next' | 'first' | 'last') => {
    if (!report) return;
    const maxPly = report.moves.length;
    setCurrentPly(prev => {
      let next = prev;
      switch (direction) {
        case 'prev': next = Math.max(0, prev - 1); break;
        case 'next': next = Math.min(maxPly, prev + 1); break;
        case 'first': next = 0; break;
        case 'last': next = maxPly; break;
      }
      if (next !== prev && next > 0) {
        const move = report.moves[next - 1];
        if (move?.san.includes('x')) sounds.playCapture();
        else if (move?.san.includes('+') || move?.san.includes('#')) sounds.playCheck();
        else if (move?.classification === 'brilliant') sounds.playBrilliant();
        else if (move?.classification === 'blunder') sounds.playBlunder();
        else sounds.playMove();
      }
      return next;
    });
  }, [report]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (['input', 'textarea'].includes((e.target as HTMLElement).tagName.toLowerCase())) return;
      if (e.key === 'ArrowLeft') navigateMove('prev');
      else if (e.key === 'ArrowRight') navigateMove('next');
      else if (e.key === 'Home') navigateMove('first');
      else if (e.key === 'End') navigateMove('last');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigateMove]);

  return (
    <div className="min-h-screen bg-[#111317] text-gray-100 flex flex-col">
      {/* Top Navbar */}
      <header className="border-b border-gray-800 bg-[#16181f] sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-gray-400 hover:text-white transition-colors text-sm font-semibold flex items-center gap-1">
              <span>← Repertoire</span>
            </Link>
            <div className="h-4 w-px bg-gray-700 mx-1" />
            <span className="text-2xl">🎓</span>
            <h1 className="text-lg font-bold text-white tracking-tight">Chess Game Review</h1>
            <span className="text-[11px] text-green-400 bg-green-500/10 border border-green-500/30 px-2 py-0.5 rounded-full font-mono">
              Offline Engine Ready
            </span>
          </div>

          <div className="flex items-center gap-3">
            {report && (
              <button
                onClick={() => setShowStats(true)}
                className="px-3.5 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
              >
                <span>📊</span>
                <span>Advanced Review Stats</span>
              </button>
            )}
            <Link
              href="/builder"
              className="text-xs text-gray-400 hover:text-white transition-colors"
            >
              Repertoire Builder →
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 flex-1 w-full">
        {/* Game Setup / Import View */}
        {!report && (
          <div className="max-w-2xl mx-auto space-y-6 pt-4">
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-extrabold text-white">Full Game Review & AI Coach</h2>
              <p className="text-gray-400 text-sm">
                Analyze move quality, calculate win-probability accuracy (CAPS), identify critical blunders, and explore coach suggestions.
              </p>
            </div>

            {/* Input Switch Tabs */}
            <div className="flex gap-1.5 bg-[#181a20] p-1 rounded-xl border border-gray-800">
              <button
                onClick={() => setTab('import')}
                className={`flex-1 py-2 px-4 rounded-lg text-xs font-bold transition-all ${
                  tab === 'import' ? 'bg-[#252a34] text-white shadow-md' : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                📋 Paste PGN
              </button>
              <button
                onClick={() => setTab('chesscom')}
                className={`flex-1 py-2 px-4 rounded-lg text-xs font-bold transition-all ${
                  tab === 'chesscom' ? 'bg-[#252a34] text-white shadow-md' : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                ♟ Import from Chess.com
              </button>
            </div>

            {tab === 'import' && (
              <div className="space-y-3">
                <textarea
                  value={pgnInput}
                  onChange={(e) => setPgnInput(e.target.value)}
                  placeholder="Paste any PGN text here (with or without [%clk] time annotations)..."
                  className="w-full h-44 bg-[#181a20] border border-gray-800 rounded-xl p-4 text-xs font-mono text-gray-200 placeholder-gray-600 focus:outline-none focus:border-amber-500/60 resize-none shadow-inner"
                />
                <button
                  onClick={handleImportPGN}
                  disabled={isAnalyzing}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl transition-colors text-sm shadow-md"
                >
                  {isAnalyzing ? '⏳ Running Game Review...' : '🔍 Start Game Review'}
                </button>
              </div>
            )}

            {tab === 'chesscom' && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleFetchChessCom()}
                    placeholder="Enter username (e.g. magnuscarlsen, hikaru)..."
                    className="flex-1 bg-[#181a20] border border-gray-800 rounded-xl px-4 py-3 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-amber-500/60 shadow-inner"
                  />
                  <button
                    onClick={handleFetchChessCom}
                    disabled={gamesLoading || !username.trim()}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold rounded-xl transition-colors text-sm whitespace-nowrap shadow-md"
                  >
                    {gamesLoading ? '⏳' : '🔍'} Fetch Games
                  </button>
                </div>
                <p className="text-[11px] text-gray-500 text-center">
                  Direct REST querying of public game archives — no login required.
                </p>
              </div>
            )}

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-400 text-xs font-medium">
                ❌ {error}
              </div>
            )}

            {/* Quick Sample Games */}
            <div className="flex items-center justify-center gap-3 pt-2">
              <span className="text-xs text-gray-500">Quick Samples:</span>
              <button
                onClick={() => doAnalyze(SAMPLE_KASPAROV_PGN)}
                className="text-xs bg-gray-800/60 hover:bg-gray-800 text-gray-300 px-3 py-1.5 rounded-lg border border-gray-700/60 transition-colors"
              >
                Kasparov's Immortal (1999)
              </button>
              <button
                onClick={() => doAnalyze(SAMPLE_OPERA_PGN)}
                className="text-xs bg-gray-800/60 hover:bg-gray-800 text-gray-300 px-3 py-1.5 rounded-lg border border-gray-700/60 transition-colors"
              >
                Morphy Opera Game (1858)
              </button>
            </div>
          </div>
        )}

        {/* Active Game Review Dashboard */}
        {report && (
          <div className="space-y-4">
            {/* Top Match Information Header */}
            <div className="flex flex-wrap items-center justify-between bg-[#181a20] rounded-xl border border-gray-800 px-4 py-3 gap-3 shadow-sm">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => { setReport(null); setCurrentPly(0); setGameSummary(''); }}
                  className="text-gray-400 hover:text-white transition-colors text-xs font-bold bg-gray-800/80 px-2.5 py-1.5 rounded-lg border border-gray-700"
                >
                  ← New Game
                </button>
                <div className="h-4 w-px bg-gray-700 hidden sm:block" />
                <div className="text-sm flex items-center gap-2">
                  <span className="text-white font-bold">{report.whitePlayer}</span>
                  {report.whiteRating && <span className="text-gray-400 text-xs font-mono">({report.whiteRating})</span>}
                  <span className="text-gray-500 font-bold text-xs">vs</span>
                  <span className="text-white font-bold">{report.blackPlayer}</span>
                  {report.blackRating && <span className="text-gray-400 text-xs font-mono">({report.blackRating})</span>}
                </div>
                <div className="h-4 w-px bg-gray-700 hidden md:block" />
                <span className="text-xs text-gray-400 hidden md:inline">{report.openingName} ({report.eco})</span>
              </div>

              {/* Accuracy Bars */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-gray-200 font-bold">{report.whiteAccuracy}%</span>
                  <div className="w-16 h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full bg-gray-200" style={{ width: `${report.whiteAccuracy}%` }} />
                  </div>
                </div>
                <span className="text-gray-500 text-xs font-bold">vs</span>
                <div className="flex items-center gap-1.5 text-xs">
                  <div className="w-16 h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500" style={{ width: `${report.blackAccuracy}%` }} />
                  </div>
                  <span className="text-blue-400 font-bold">{report.blackAccuracy}%</span>
                </div>
                <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
                  {report.result}
                </span>
              </div>
            </div>

            {/* 3-Column Review Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr_310px] gap-4 items-start">
              {/* Left Column: Vertical Eval Bar + Board */}
              <div className="flex gap-2 justify-center lg:justify-start">
                <div className="h-[480px] sm:h-[540px]">
                  <EvalBar eval_={currentEval} />
                </div>
                <div className="w-[480px] sm:w-[540px]">
                  <Board fen={currentFen} currentMove={currentMove} />
                </div>
              </div>

              {/* Center Column: Eval Advantage Graph + Navigation + Move List */}
              <div className="space-y-3 min-w-0">
                <EvalGraph
                  moves={report.moves}
                  currentPly={currentPly}
                  onMoveClick={(ply) => setCurrentPly(ply)}
                />

                {/* Move Navigation Buttons */}
                <div className="flex items-center justify-center gap-1.5 bg-[#181a20] p-2 rounded-xl border border-gray-800">
                  <button onClick={() => navigateMove('first')} className="px-3 py-1.5 bg-[#20232b] hover:bg-gray-700 rounded-lg text-xs font-bold text-gray-300 transition-colors">⏮</button>
                  <button onClick={() => navigateMove('prev')} className="px-4 py-1.5 bg-[#20232b] hover:bg-gray-700 rounded-lg text-xs font-bold text-gray-300 transition-colors">◀ Prev</button>
                  <span className="text-xs text-gray-300 px-3 font-mono font-bold min-w-[120px] text-center">
                    {currentPly > 0 ? `Move ${Math.ceil(currentPly / 2)}${currentPly % 2 === 1 ? '.' : '...'} ${currentMove?.san || ''}` : 'Start Position'}
                  </span>
                  <button onClick={() => navigateMove('next')} className="px-4 py-1.5 bg-[#20232b] hover:bg-gray-700 rounded-lg text-xs font-bold text-gray-300 transition-colors">Next ▶</button>
                  <button onClick={() => navigateMove('last')} className="px-3 py-1.5 bg-[#20232b] hover:bg-gray-700 rounded-lg text-xs font-bold text-gray-300 transition-colors">⏭</button>
                </div>

                <MoveList
                  moves={report.moves}
                  currentPly={currentPly}
                  onMoveSelect={(ply) => setCurrentPly(ply)}
                />
              </div>

              {/* Right Column: Coach Commentary Card + Summary */}
              <div className="space-y-3">
                <CoachReviewCard move={currentMove} report={report} />

                {gameSummary && (
                  <div className="bg-[#181a20] rounded-xl border border-gray-800 p-3.5 shadow-sm space-y-2">
                    <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider">📋 Match Assessment</h3>
                    <pre className="text-[11px] text-gray-400 whitespace-pre-wrap font-sans leading-relaxed">
                      {gameSummary}
                    </pre>
                  </div>
                )}

                <button
                  onClick={() => setShowStats(true)}
                  className="w-full py-2.5 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-bold transition-colors shadow-sm"
                >
                  📊 Full Phase & Accuracy Breakdown
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modals */}
      {showStats && report && (
        <AdvancedStatsModal report={report} onClose={() => setShowStats(false)} />
      )}
      {showGameList && (
        <GameListModal
          games={games}
          username={username}
          onSelectGame={handleSelectGame}
          onClose={() => setShowGameList(false)}
          loading={gamesLoading}
        />
      )}
    </div>
  );
}
