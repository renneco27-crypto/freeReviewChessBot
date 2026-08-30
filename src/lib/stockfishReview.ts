import { Chess } from 'chess.js';
import type { MoveAnalysis, MoveClassification, GameReviewReport } from '../types/review';
import { identifyOpening } from './ecoDatabase';

export interface StockfishLine {
  move: string;
  cp: number | null;
  mateIn: number | null;
  pv: string[];
  depth: number;
}

export function toCp(line: StockfishLine | null | undefined): number {
  if (!line) return 0;
  if (typeof line.mateIn === 'number') {
    return line.mateIn > 0 ? 100000 - line.mateIn : -100000 - line.mateIn;
  }
  return typeof line.cp === 'number' ? line.cp : 0;
}

// Empirical polynomial threshold curve from freeReviewChessBot-main
export function getThresh(category: MoveClassification, prevCp: number): number {
  const a = Math.abs(prevCp);
  if (category === 'best') return Math.max(0, 0.0001 * a * a + 0.0236 * a - 3.7143);
  if (category === 'excellent') return Math.max(0, 0.0002 * a * a + 0.1231 * a + 27.5455);
  if (category === 'good') return Math.max(0, 0.0002 * a * a + 0.2643 * a + 60.5455);
  if (category === 'inaccuracy') return Math.max(0, 0.0002 * a * a + 0.3624 * a + 108.0909);
  if (category === 'mistake') return Math.max(0, 0.0003 * a * a + 0.4027 * a + 225.8182);
  return Infinity;
}

export function detectBrilliantSacrifice(
  playedUci: string,
  evBefore: number,
  evAfter: number,
  boardBefore: Chess
): boolean {
  if (!boardBefore) return false;
  const BRILLIANT_GAIN_CP = 200;
  const WINNING_THRESHOLD = 600;

  const from = playedUci.slice(0, 2);
  const to = playedUci.slice(2, 4);
  const piece = boardBefore.get(from as any);

  // Pawns and Kings (e.g. castling) cannot be brilliant sacrifices
  if (!piece || piece.type === 'p' || piece.type === 'k') return false;
  if (evBefore >= WINNING_THRESHOLD || evBefore <= -WINNING_THRESHOLD) return false;

  const gain = evAfter - evBefore;
  if (isNaN(gain) || gain < BRILLIANT_GAIN_CP) return false;

  const opponentColor = piece.color === 'w' ? 'b' : 'w';

  // Check if target square is attacked by opponent
  try {
    const tokens = boardBefore.fen().split(' ');
    tokens[1] = opponentColor;
    tokens[3] = '-';
    const tempOpp = new Chess(tokens.join(' '));
    const oppAttacks = tempOpp.moves({ verbose: true }).some(m => m.to === to);
    if (!oppAttacks) return false;
  } catch {
    return false;
  }

  return true;
}

export function classifyMove(
  topBefore: StockfishLine | null,
  secondBefore: StockfishLine | null,
  afterLine: StockfishLine | null,
  playedUci: string,
  boardBefore: Chess,
  isBook: boolean
): MoveClassification {
  if (isBook) return 'book';
  if (!topBefore || !afterLine) return 'good';

  // In Stockfish UCI, score cp is relative to side-to-move.
  // When a move is made, the side-to-move flips, so invert afterLine score.
  const afterNeg: StockfishLine = {
    ...afterLine,
    cp: typeof afterLine.cp === 'number' ? -afterLine.cp : null,
    mateIn: typeof afterLine.mateIn === 'number' ? -afterLine.mateIn : null,
  };

  const evBefore = toCp(topBefore);
  const evAfter = toCp(afterNeg);
  const delta = Math.max(0, evBefore - evAfter);
  const prevCp = topBefore.cp || 0;
  const onlyMove = secondBefore && (toCp(topBefore) - toCp(secondBefore)) >= 350;

  if (typeof afterNeg.mateIn === 'number') {
    if (afterNeg.mateIn < 0) return 'blunder';
    if (afterNeg.mateIn > 0 && evBefore < 50000) return 'best';
  }

  if (playedUci === topBefore.move) return onlyMove ? 'great' : 'best';
  if (onlyMove) return 'blunder';

  // Check brilliant sacrifice
  if (detectBrilliantSacrifice(playedUci, evBefore, evAfter, boardBefore)) return 'brilliant';

  // Losing capture override: moved into a defended square losing >= 4 net pawns
  if (boardBefore && delta >= 200) {
    const from = playedUci.slice(0, 2);
    const to = playedUci.slice(2, 4);
    const movingPiece = boardBefore.get(from as any);
    const capturedPiece = boardBefore.get(to as any);
    if (movingPiece && capturedPiece) {
      const PIECE_VAL: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
      const attackerVal = PIECE_VAL[movingPiece.type] || 0;
      const captureVal = PIECE_VAL[capturedPiece.type] || 0;
      const opponentColor = movingPiece.color === 'w' ? 'b' : 'w';

      const tokens = boardBefore.fen().split(' ');
      tokens[1] = opponentColor;
      tokens[3] = '-';
      try {
        const tempOpp = new Chess(tokens.join(' '));
        const squareDefended = tempOpp.moves({ verbose: true }).some(m => m.to === to);
        const netLoss = squareDefended ? attackerVal - captureVal : 0;
        if (netLoss >= 4) return 'blunder';
      } catch {}
    }
  }

  const cats: MoveClassification[] = ['best', 'excellent', 'good', 'inaccuracy', 'mistake'];
  for (const c of cats) {
    if (delta <= getThresh(c, prevCp)) {
      return c;
    }
  }

  return 'blunder';
}

export function parseLines(lines: string[]): StockfishLine[] {
  const byPV: Record<number, StockfishLine> = {};
  lines.forEach(l => {
    if (l.indexOf('info') !== 0) return;
    const pvM = l.match(/\bpv\s+(\S+)/);
    const cpM = l.match(/\bscore cp (-?\d+)/);
    const mateM = l.match(/\bscore mate (-?\d+)/);
    const pvIdM = l.match(/\bmultipv (\d+)/);
    const depM = l.match(/\bdepth (\d+)/);
    if (!pvM) return;
    const pvId = pvIdM ? +pvIdM[1] : 1;
    const dep = depM ? +depM[1] : 0;
    if (!byPV[pvId] || dep >= byPV[pvId].depth) {
      const pvFull = l.match(/\bpv\s+(.+)/);
      const pvArr = pvFull ? pvFull[1].trim().split(/\s+/) : [pvM[1]];
      byPV[pvId] = {
        move: pvM[1],
        pv: pvArr.slice(0, 10),
        cp: cpM ? +cpM[1] : null,
        mateIn: mateM ? +mateM[1] : null,
        depth: dep,
      };
    }
  });
  return Object.values(byPV);
}

export async function runStockfishGameReview(
  pgn: string,
  onProgress?: (current: number, total: number, message: string) => void,
  depth = 10
): Promise<GameReviewReport> {
  const chess = new Chess();
  chess.loadPgn(pgn);

  const headers = chess.header();
  const movesHistory = chess.history({ verbose: true });
  if (movesHistory.length === 0) throw new Error('No moves found in PGN');

  const sanMoves = movesHistory.map(m => m.san);
  const opening = identifyOpening(sanMoves);

  // Collect all FEN positions: start pos + each move after
  const allPositions: { fen: string; move?: (typeof movesHistory)[0]; idx: number }[] = [
    { fen: new Chess().fen(), idx: -1 },
  ];
  const replay = new Chess();
  for (let i = 0; i < movesHistory.length; i++) {
    replay.move(movesHistory[i]);
    allPositions.push({ fen: replay.fen(), move: movesHistory[i], idx: i });
  }

  // Create Stockfish worker
  const worker = new Worker('/stockfish.js');
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Stockfish worker init timeout')), 10000);
    const onMsg = (e: MessageEvent) => {
      const line = e.data;
      if (typeof line === 'string') {
        if (line === 'uciok') worker.postMessage('isready');
        else if (line === 'readyok') {
          clearTimeout(timeout);
          worker.removeEventListener('message', onMsg);
          resolve();
        }
      }
    };
    worker.addEventListener('message', onMsg);
    worker.postMessage('uci');
  });

  // Helper to evaluate a single position
  const evalPosition = (fen: string): Promise<StockfishLine[]> => {
    return new Promise((resolve) => {
      const buf: string[] = [];
      const onMsg = (e: MessageEvent) => {
        const line = e.data;
        if (typeof line === 'string') {
          buf.push(line);
          if (line.startsWith('bestmove')) {
            worker.removeEventListener('message', onMsg);
            resolve(parseLines(buf));
          }
        }
      };
      worker.addEventListener('message', onMsg);
      worker.postMessage(`position fen ${fen}`);
      worker.postMessage(`go depth ${depth} movetime 1200`);
    });
  };

  // Evaluate all positions sequentially with progress updates
  const evals: (StockfishLine | null)[] = [];
  for (let i = 0; i < allPositions.length; i++) {
    if (onProgress) {
      onProgress(i + 1, allPositions.length, `Stockfish analyzing position ${i + 1}/${allPositions.length}...`);
    }
    const lines = await evalPosition(allPositions[i].fen);
    evals.push(lines[0] || null);
  }

  worker.terminate();

  // Classify each move
  const moveAnalyses: MoveAnalysis[] = [];

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

    // Compute white-relative evaluation in centipawns
    const isWhite = m.color === 'w';
    const whiteEvalBefore = isWhite ? cpBefore : -cpBefore;
    const whiteEvalAfter = isWhite ? -cpAfter : cpAfter; // Inverted because side flipped

    const wpBefore = isWhite
      ? 1 / (1 + Math.pow(10, -whiteEvalBefore / 400))
      : 1 - 1 / (1 + Math.pow(10, -whiteEvalBefore / 400));
    const wpAfter = isWhite
      ? 1 / (1 + Math.pow(10, -whiteEvalAfter / 400))
      : 1 - 1 / (1 + Math.pow(10, -whiteEvalAfter / 400));
    const wpLoss = wpBefore - wpAfter;

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
      isKeyMoment,
    });
  }

  // Calculate Accuracy using the empirical weights from freeReviewChessBot
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
    const v = vals[m.classification] || 0.75;
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
    const sum = moves.reduce((acc, m) => acc + (vals[m.classification] || 0.75), 0);
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
