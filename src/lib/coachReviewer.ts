import type { MoveAnalysis, GameReviewReport } from '../types/review';

const BRILLIANT_COMMENTS = [
  '💎 Brilliant move! This unexpected sacrifice creates a devastating initiative.',
  '💎 Outstanding! This move finds a deeply tactical resource that changes everything.',
  '💎 A creative and powerful decision — engine-approved brilliance!',
  '💎 Incredible find! This move was nearly impossible to spot over the board.',
];

const BEST_COMMENTS = [
  '✅ Perfect! This is the engine\'s top choice.',
  '✅ Excellent judgment — you found the strongest continuation.',
  '✅ Spot on. This move maintains your advantage precisely.',
];

const GREAT_COMMENTS = [
  '👍 Great move! Very close to the engine\'s top pick.',
  '👍 Strong play — this keeps the position firmly in your favor.',
  '👍 Well played. A natural and strong continuation.',
];

const GOOD_COMMENTS = [
  '👌 Good move. Solid and practical.',
  '👌 A reasonable choice — no real damage done.',
  '👌 Perfectly adequate — this keeps the game balanced.',
];

const INACCURACY_COMMENTS = [
  '⚠️ Slight inaccuracy. A small slip that gives your opponent some breathing room.',
  '⚠️ This move is okay, but there was a stronger option available.',
  '⚠️ Minor imprecision — the position is still manageable.',
];

const MISTAKE_COMMENTS = [
  '❌ Mistake! This move significantly worsens your position.',
  '❌ A costly error — your opponent now has a clear advantage.',
  '❌ This misstep changes the evaluation substantially.',
];

const BLUNDER_COMMENTS = [
  '🚨 Blunder! This move throws away a winning or equal position.',
  '🚨 Critical blunder — the position is now lost or heavily compromised.',
  '🚨 A devastating mistake. The game swings completely.',
  '🚨 Major oversight! This allows your opponent a decisive advantage.',
];

const BOOK_COMMENTS = [
  '📖 Opening book move — this is well-established theory.',
  '📖 Standard opening play. Following known theory.',
  '📖 A mainline theoretical move in this opening.',
];

function pickRandom<T>(arr: T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length];
}

export function generateMoveCommentary(move: MoveAnalysis, _report: GameReviewReport): string {
  const seed = move.ply * 17 + move.san.charCodeAt(0);

  switch (move.classification) {
    case 'brilliant':
      return pickRandom(BRILLIANT_COMMENTS, seed);
    case 'best':
      return pickRandom(BEST_COMMENTS, seed);
    case 'great':
      return pickRandom(GREAT_COMMENTS, seed);
    case 'excellent':
      return pickRandom(GREAT_COMMENTS, seed);
    case 'good':
      return pickRandom(GOOD_COMMENTS, seed);
    case 'book':
      return pickRandom(BOOK_COMMENTS, seed);
    case 'inaccuracy':
      return pickRandom(INACCURACY_COMMENTS, seed);
    case 'mistake':
      return pickRandom(MISTAKE_COMMENTS, seed);
    case 'miss':
      return pickRandom(MISTAKE_COMMENTS, seed);
    case 'blunder':
      return pickRandom(BLUNDER_COMMENTS, seed);
    default:
      return 'Analyzing position...';
  }
}

export function generateGameSummary(report: GameReviewReport): string {
  const { whiteAccuracy, blackAccuracy, whitePlayer, blackPlayer, openingName, result, stats } = report;

  const whiteBlunders = stats.white.blunder + stats.white.miss;
  const blackBlunders = stats.black.blunder + stats.black.miss;
  const whiteBrilliants = stats.white.brilliant;
  const blackBrilliants = stats.black.brilliant;

  let summary = `📊 Game Review Summary\n`;
  summary += `Opening: ${openingName || 'Standard Game'} (${report.eco})\n`;
  summary += `Result: ${result}\n\n`;

  summary += `${whitePlayer} (White): ${whiteAccuracy}% accuracy\n`;
  if (whiteBrilliants > 0) summary += `  💎 ${whiteBrilliants} brilliant move${whiteBrilliants > 1 ? 's' : ''}\n`;
  if (whiteBlunders > 0) summary += `  🚨 ${whiteBlunders} blunder${whiteBlunders > 1 ? 's' : ''}\n`;

  summary += `\n${blackPlayer} (Black): ${blackAccuracy}% accuracy\n`;
  if (blackBrilliants > 0) summary += `  💎 ${blackBrilliants} brilliant move${blackBrilliants > 1 ? 's' : ''}\n`;
  if (blackBlunders > 0) summary += `  🚨 ${blackBlunders} blunder${blackBlunders > 1 ? 's' : ''}\n`;

  const keyMoments = report.moves.filter(m => m.isKeyMoment);
  if (keyMoments.length > 0) {
    summary += `\n🔑 Key Moments: ${keyMoments.length} critical position${keyMoments.length > 1 ? 's' : ''} identified\n`;
    keyMoments.slice(0, 3).forEach(m => {
      const player = m.color === 'w' ? whitePlayer : blackPlayer;
      summary += `  Move ${m.moveNumber}. ${m.san} by ${player} — ${m.classification}\n`;
    });
  }

  summary += `\n📈 Phase Performance:\n`;
  summary += `  Opening — White: ${stats.phaseAccuracy.opening.white}% | Black: ${stats.phaseAccuracy.opening.black}%\n`;
  summary += `  Middlegame — White: ${stats.phaseAccuracy.middlegame.white}% | Black: ${stats.phaseAccuracy.middlegame.black}%\n`;
  summary += `  Endgame — White: ${stats.phaseAccuracy.endgame.white}% | Black: ${stats.phaseAccuracy.endgame.black}%\n`;

  return summary;
}
