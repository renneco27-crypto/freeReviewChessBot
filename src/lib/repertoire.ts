import { Chess } from 'chess.js';

export type RepertoireNode = {
  san: string;
  fen: string;
  count: number;
  children: RepertoireNode[];
};

export function parseGamesToTree(pgns: string, maxPly: number = 30): RepertoireNode[] {
  const games = pgns.split(/(?=\[Event ")/).filter(g => g.trim().length > 0);
  const rootMap: Record<string, RepertoireNode> = {};

  for (const pgn of games) {
    const chess = new Chess();
    try {
      chess.loadPgn(pgn);
    } catch (e) {
      continue;
    }

    const history = chess.history();
    let currentLevel = rootMap;
    const tempChess = new Chess();

    for (let i = 0; i < Math.min(history.length, maxPly); i++) {
      const moveSan = history[i];
      tempChess.move(moveSan);
      const fen = tempChess.fen();

      if (!currentLevel[moveSan]) {
        currentLevel[moveSan] = {
          san: moveSan,
          fen: fen,
          count: 0,
          children: [] // We'll map the next level's Record to this array at the end
        };
      }
      
      currentLevel[moveSan].count += 1;
      
      // Store next level internally as a dictionary on the object to make lookup fast,
      // but we'll strip it when finalizing.
      if (!(currentLevel[moveSan] as any)._childrenMap) {
        (currentLevel[moveSan] as any)._childrenMap = {};
      }
      currentLevel = (currentLevel[moveSan] as any)._childrenMap;
    }
  }

  // Recursive function to convert the internal `_childrenMap` to the sorted `children` array
  function finalizeTree(nodeMap: Record<string, any>): RepertoireNode[] {
    const arr = Object.values(nodeMap);
    arr.sort((a, b) => b.count - a.count);
    for (const node of arr) {
      if (node._childrenMap) {
        node.children = finalizeTree(node._childrenMap);
        delete node._childrenMap;
      }
    }
    return arr;
  }

  return finalizeTree(rootMap);
}
