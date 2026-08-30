import { Chess } from 'chess.js';
import type { MoveAnalysis, MoveClassification, GameReviewReport } from '../types/review';
import { identifyOpening } from './ecoDatabase';
import { classifyMove, detectBrilliantSacrifice, toCp } from './stockfishReview';

// Convert centipawns to win probability
export function cpToWinProb(cp: number): number {
  return 1 / (1 + Math.pow(10, -cp / 400));
}

// Simple material & position evaluator for fast instant fallback
function evaluatePosition(chess: Chess): { move: string; cp: number; mateIn: null; pv: string[]; depth: number } {
  const board = chess.board();
  const pieceValues: Record<string, number> = { p: 100, n: 315, b: 335, r: 500, q: 900, k: 0 };
  let eval_ = 0;
  let whiteMobility = 0;
  let blackMobility = 0;

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (piece) {
        const value = pieceValues[piece.type] || 0;
        const sign = piece.color === 'w' ? 1 : -1;
        eval_ += sign * value;

        // Center control
        if (col >= 2 && col <= 5 && row >= 2 && row <= 5) {
          eval_ += sign * 10;
        }
        // Advanced pawn
        if (piece.type === 'p') {
          if (piece.color === 'w') {
            eval_ += (7 - row) * 5;
          } else {
            eval_ -= row * 5;
          }
        }
        if (piece.color === 'w') whiteMobility++;
        else blackMobility++;
      }
    }
  }

  eval_ += (whiteMobility - blackMobility) * 2;

  // Best legal move heuristic
  const legalMoves = chess.moves({ verbose: true });
  const bestMove = legalMoves.length > 0 ? legalMoves[0].from + legalMoves[0].to : '';

  // Stockfish UCI returns cp from perspective of side to move
  const sideSign = chess.turn() === 'w' ? 1 : -1;
  return {
    move: bestMove,
    cp: eval_ * sideSign,
    mateIn: null,
    pv: [bestMove],
    depth: 10,
  };
}

function parseClockFromSan(rawSan: string): { san: string; clock?: string } {
  const clockMatch = rawSan.match(/\{\[%clk\s+([^\]]+)\]\}/);
  const san = rawSan.replace(/\s*\{[^}]*\}\s*/g, '').trim();
  return { san, clock: clockMatch ? clockMatch[1] : undefined };
}

function parseTimeToSeconds(timeStr: string): number {
  const parts = timeStr.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || 0;
}

export function analyzePGN(pgn: string): GameReviewReport {
  const chess = new Chess();
  chess.loadPgn(pgn);

  const headers = chess.header();
  const movesHistory = chess.history({ verbose: true });

  const sanMoves = movesHistory.map(m => m.san);
  const opening = identifyOpening(sanMoves);

  const replay = new Chess();
  const allPositions = [{ fen: new Chess().fen(), idx: -1 }];
  for (let i = 0; i < movesHistory.length; i++) {
    replay.move(movesHistory[i]);
    allPositions.push({ fen: replay.fen(), idx: i });
  }

  const evals = allPositions.map(p => {
    const c = new Chess(p.fen);
    return evaluatePosition(c);
  });

  const moveAnalyses: MoveAnalysis[] = [];
  let prevClock: string | undefined;

  const moveTextMatch = pgn.match(/\n\n([\s\S]+)$/) || pgn.match(/^([\s\S]+)$/);
  const rawMoveText = moveTextMatch ? moveTextMatch[1] : '';
  const rawTokens = rawMoveText
    .replace(/\d+\.+\s*/g, '')
    .replace(/(1-0|0-1|1\/2-1\/2|\*)\s*$/, '')
    .split(/\s+/)
    .filter(t => t.length > 0);

  for (let j = 0; j < movesHistory.length; j++) {
    const m = movesHistory[j];
    const fenBefore = allPositions[j].fen;
    const fenAfter = allPositions[j + 1].fen;
    const prevEvalLine = evals[j];
    const afterEvalLine = evals[j + 1];

    const uci = m.from + m.to + (m.promotion || '');
    const isBook = j < opening.bookMovesCount;

    const boardBefore = new Chess(fenBefore);
    const classification = classifyMove(prevEvalLine, null, afterEvalLine, uci, boardBefore, isBook);

    const cpBefore = toCp(prevEvalLine);
    const cpAfter = toCp(afterEvalLine);

    const isWhite = m.color === 'w';
    const whiteEvalBefore = isWhite ? cpBefore : -cpBefore;
    const whiteEvalAfter = isWhite ? -cpAfter : cpAfter;

    const wpBefore = isWhite
      ? 1 / (1 + Math.pow(10, -whiteEvalBefore / 400))
      : 1 - 1 / (1 + Math.pow(10, -whiteEvalBefore / 400));
    const wpAfter = isWhite
      ? 1 / (1 + Math.pow(10, -whiteEvalAfter / 400))
      : 1 - 1 / (1 + Math.pow(10, -whiteEvalAfter / 400));
    const wpLoss = wpBefore - wpAfter;

    let clockTime: string | undefined;
    let secondsSpent: number | undefined;

    if (rawTokens[j]) {
      const parsed = parseClockFromSan(rawTokens[j]);
      clockTime = parsed.clock;
      if (clockTime && prevClock) {
        secondsSpent = parseTimeToSeconds(prevClock) - parseTimeToSeconds(clockTime);
        if (secondsSpent < 0) secondsSpent = 0;
      }
    }

    const isKeyMoment = classification === 'blunder' || classification === 'brilliant' || classification === 'miss';

    moveAnalyses.push({
      moveNumber: Math.floor(j / 2) + 1,
      ply: j + 1,
      color: m.color,
      san: m.san,
      uci,
      from: m.from,
      to: m.to,
      fenBefore,
      fenAfter,
      evalBefore: whiteEvalBefore,
      evalAfter: whiteEvalAfter,
      bestMoveUci: prevEvalLine?.move,
      classification,
      winProbBefore: Math.round(wpBefore * 1000) / 10,
      winProbAfter: Math.round(wpAfter * 1000) / 10,
      winProbLoss: Math.round(wpLoss * 1000) / 10,
      clockTime,
      secondsSpent,
      isKeyMoment,
    });

    if (clockTime) prevClock = clockTime;
  }

  const vals: Record<MoveClassification, number> = {
    blunder: 0,
    miss: 0.1,
    mistake: 0.25,
    inaccuracy: 0.5,
    good: 0.75,
    excellent: 0.92,
    best: 1.0,
    great: 1.0,
    brilliant: 1.0,
    book: 1.0,
  };

  let wSum = 0, wCount = 0, bSum = 0, bCount = 0;
  moveAnalyses.forEach(m => {
    const v = vals[m.classification] || 0.7;
    if (m.color === 'w') {
      wSum += v;
      wCount++;
    } else {
      bSum += v;
      bCount++;
    }
  });

  const whiteAccuracy = wCount > 0 ? Math.round((wSum / wCount) * 1000) / 10 : 100;
  const blackAccuracy = bCount > 0 ? Math.round((bSum / bCount) * 1000) / 10 : 100;

  const classifications: MoveClassification[] = [
    'brilliant', 'great', 'best', 'excellent', 'good', 'book', 'inaccuracy', 'mistake', 'miss', 'blunder',
  ];
  const makeCountRecord = (moves: MoveAnalysis[]): Record<MoveClassification, number> => {
    const rec = {} as Record<MoveClassification, number>;
    for (const c of classifications) rec[c] = moves.filter(m => m.classification === c).length;
    return rec;
  };

  const whiteMoves = moveAnalyses.filter(m => m.color === 'w');
  const blackMoves = moveAnalyses.filter(m => m.color === 'b');

  const calcPhaseAcc = (moves: MoveAnalysis[]) => {
    if (moves.length === 0) return 100;
    const sum = moves.reduce((acc, m) => acc + (vals[m.classification] || 0.7), 0);
    return Math.round((sum / moves.length) * 1000) / 10;
  };

  const phaseAccuracy = {
    opening: {
      white: calcPhaseAcc(whiteMoves.filter((_, i) => i < 10)),
      black: calcPhaseAcc(blackMoves.filter((_, i) => i < 10)),
    },
    middlegame: {
      white: calcPhaseAcc(whiteMoves.filter((_, i) => i >= 10 && i < Math.floor(whiteMoves.length * 0.65))),
      black: calcPhaseAcc(blackMoves.filter((_, i) => i >= 10 && i < Math.floor(blackMoves.length * 0.65))),
    },
    endgame: {
      white: calcPhaseAcc(whiteMoves.filter((_, i) => i >= Math.floor(whiteMoves.length * 0.65))),
      black: calcPhaseAcc(blackMoves.filter((_, i) => i >= Math.floor(blackMoves.length * 0.65))),
    },
  };

  return {
    whiteAccuracy,
    blackAccuracy,
    whitePlayer: headers.White || 'White',
    blackPlayer: headers.Black || 'Black',
    whiteRating: headers.WhiteElo ? parseInt(headers.WhiteElo) : undefined,
    blackRating: headers.BlackElo ? parseInt(headers.BlackElo) : undefined,
    result: (headers.Result as string) || '*',
    timeControl: (headers.TimeControl as string) || undefined,
    date: ((headers.Date || headers.UTCDate) as string) || undefined,
    eco: opening.eco,
    openingName: opening.name,
    moves: moveAnalyses,
    keyMomentsCount: moveAnalyses.filter(m => m.isKeyMoment).length,
    stats: {
      white: makeCountRecord(whiteMoves),
      black: makeCountRecord(blackMoves),
      phaseAccuracy,
    },
  };
}
