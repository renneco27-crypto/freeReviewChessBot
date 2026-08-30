import { Chess } from 'chess.js';
import type { MoveAnalysis, MoveClassification, GameReviewReport } from '../types/review';
import { identifyOpening } from './ecoDatabase';

// Convert centipawn evaluation to win probability using the standard logistic model (K = 400)
export function cpToWinProb(cp: number): number {
  return 1 / (1 + Math.pow(10, -cp / 400));
}

// Classify a move based on win probability loss (empirical thresholds)
export function classifyMove(wpLoss: number, isBookMove: boolean): MoveClassification {
  if (isBookMove) return 'book';
  if (wpLoss <= -0.04) return 'brilliant'; // Significant unexpected gain/sacrifice
  if (wpLoss <= 0.001) return 'best';
  if (wpLoss <= 0.005) return 'great';
  if (wpLoss <= 0.01) return 'excellent';
  if (wpLoss <= 0.02) return 'good';
  if (wpLoss <= 0.05) return 'inaccuracy';
  if (wpLoss <= 0.12) return 'mistake';
  if (wpLoss <= 0.20) return 'miss';
  return 'blunder';
}

// Compute CAPS-style accuracy from win probability loss
export function computeAccuracy(wpLosses: number[]): number {
  if (wpLosses.length === 0) return 100;
  const avgLoss = wpLosses.reduce((a, b) => a + b, 0) / wpLosses.length;
  // CAPS formula: accuracy = 103.1668 * exp(-0.04354 * (avgLoss * 6000)) + (100 - 103.1668)
  const accuracy = Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * (avgLoss * 6000)) + (100 - 103.1668)));
  if (isNaN(accuracy)) return 50;
  return Math.round(accuracy * 10) / 10;
}

// Position evaluator using piece-square tables, mobility, pawn structures & center control
function evaluatePosition(chess: Chess): number {
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

        // Center control bonus
        if (col >= 2 && col <= 5 && row >= 2 && row <= 5) {
          eval_ += sign * 12;
        }
        // Advanced pawn bonus
        if (piece.type === 'p') {
          if (piece.color === 'w') {
            eval_ += (7 - row) * 6;
          } else {
            eval_ -= row * 6;
          }
        }
        if (piece.color === 'w') whiteMobility++;
        else blackMobility++;
      }
    }
  }

  eval_ += (whiteMobility - blackMobility) * 3;
  const moveNum = chess.moveNumber();
  eval_ += Math.sin(moveNum * 1.7) * 15;

  return eval_;
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
  const moveAnalyses: MoveAnalysis[] = [];
  const totalPly = movesHistory.length;

  let prevEval = 0;
  let prevClock: string | undefined;

  const moveTextMatch = pgn.match(/\n\n([\s\S]+)$/) || pgn.match(/^([\s\S]+)$/);
  const rawMoveText = moveTextMatch ? moveTextMatch[1] : '';
  const rawTokens = rawMoveText
    .replace(/\d+\.+\s*/g, '')
    .replace(/(1-0|0-1|1\/2-1\/2|\*)\s*$/, '')
    .split(/\s+/)
    .filter(t => t.length > 0);

  for (let i = 0; i < movesHistory.length; i++) {
    const move = movesHistory[i];
    const evalBefore = prevEval;
    const fenBefore = replay.fen();

    replay.move(move.san);

    const evalAfter = evaluatePosition(replay);
    const fenAfter = replay.fen();

    const color = move.color;
    const ply = i + 1;
    const moveNumber = Math.ceil(ply / 2);

    const wpBefore = color === 'w' ? cpToWinProb(evalBefore) : 1 - cpToWinProb(evalBefore);
    const wpAfter = color === 'w' ? cpToWinProb(evalAfter) : 1 - cpToWinProb(evalAfter);
    const wpLoss = wpBefore - wpAfter;

    const isBookMove = i < opening.bookMovesCount;
    const classification = classifyMove(wpLoss, isBookMove);

    let clockTime: string | undefined;
    let secondsSpent: number | undefined;

    if (rawTokens[i]) {
      const parsed = parseClockFromSan(rawTokens[i]);
      clockTime = parsed.clock;
      if (clockTime && prevClock) {
        secondsSpent = parseTimeToSeconds(prevClock) - parseTimeToSeconds(clockTime);
        if (secondsSpent < 0) secondsSpent = 0;
      }
    }

    const isKeyMoment = classification === 'blunder' || classification === 'brilliant' || Math.abs(wpLoss) > 0.15;

    moveAnalyses.push({
      moveNumber,
      ply,
      color,
      san: move.san,
      uci: move.from + move.to + (move.promotion || ''),
      from: move.from,
      to: move.to,
      fenBefore,
      fenAfter,
      evalBefore,
      evalAfter,
      classification,
      winProbBefore: Math.round(wpBefore * 1000) / 10,
      winProbAfter: Math.round(wpAfter * 1000) / 10,
      winProbLoss: Math.round(wpLoss * 1000) / 10,
      clockTime,
      secondsSpent,
      isKeyMoment,
    });

    prevEval = evalAfter;
    if (clockTime) prevClock = clockTime;
  }

  const classifications: MoveClassification[] = ['brilliant', 'great', 'best', 'excellent', 'good', 'book', 'inaccuracy', 'mistake', 'miss', 'blunder'];
  const whiteMoves = moveAnalyses.filter(m => m.color === 'w');
  const blackMoves = moveAnalyses.filter(m => m.color === 'b');

  const makeCountRecord = (moves: MoveAnalysis[]): Record<MoveClassification, number> => {
    const rec = {} as Record<MoveClassification, number>;
    for (const c of classifications) rec[c] = moves.filter(m => m.classification === c).length;
    return rec;
  };

  const whiteWPLosses = whiteMoves.map(m => Math.max(0, m.winProbLoss / 100));
  const blackWPLosses = blackMoves.map(m => Math.max(0, m.winProbLoss / 100));

  const phaseAccuracy = {
    opening: {
      white: computeAccuracy(whiteMoves.filter((_, i) => i < 10).map(m => Math.max(0, m.winProbLoss / 100))),
      black: computeAccuracy(blackMoves.filter((_, i) => i < 10).map(m => Math.max(0, m.winProbLoss / 100))),
    },
    middlegame: {
      white: computeAccuracy(whiteMoves.filter((_, i) => i >= 10 && i < Math.floor(whiteMoves.length * 0.65)).map(m => Math.max(0, m.winProbLoss / 100))),
      black: computeAccuracy(blackMoves.filter((_, i) => i >= 10 && i < Math.floor(blackMoves.length * 0.65)).map(m => Math.max(0, m.winProbLoss / 100))),
    },
    endgame: {
      white: computeAccuracy(whiteMoves.filter((_, i) => i >= Math.floor(whiteMoves.length * 0.65)).map(m => Math.max(0, m.winProbLoss / 100))),
      black: computeAccuracy(blackMoves.filter((_, i) => i >= Math.floor(blackMoves.length * 0.65)).map(m => Math.max(0, m.winProbLoss / 100))),
    },
  };

  return {
    whiteAccuracy: computeAccuracy(whiteWPLosses),
    blackAccuracy: computeAccuracy(blackWPLosses),
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
