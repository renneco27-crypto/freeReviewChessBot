import { Chess } from 'chess.js';

export type BuilderNode = {
  id: string;
  fen: string;
  moveSan: string;
  turn: 'w' | 'b';
  source: 'maia' | 'stockfish' | 'root';
  prob?: number;
  children: BuilderNode[];
};

export type ProgressCallback = (completed: number, total: number) => void;

export async function buildRepertoireTree(
  rootFen: string,
  userColor: 'w' | 'b',
  maxFullMoves: number,
  evaluateStockfish: (fen: string) => Promise<string>,
  onProgress: ProgressCallback
): Promise<BuilderNode> {
  const rootChess = new Chess(rootFen);
  
  const rootNode: BuilderNode = {
    id: 'root-' + rootFen,
    fen: rootFen,
    moveSan: 'Root',
    turn: rootChess.turn(),
    source: 'root',
    children: [],
  };

  // We will process this breadth-first or depth-first. Let's do depth-first using a recursive function.
  // Wait, breadth-first might be better for the progress bar. Let's do a queue.
  const queue: { node: BuilderNode, plyToProcess: number }[] = [];
  
  // A ply is one turn. If maxFullMoves = 15, that's 30 plies from the START of the game.
  // We need to calculate how many plies are left.
  // rootChess.history().length or rootChess.moveNumber().
  // Let's just say we expand a certain number of plies FROM the root.
  // E.g., if we are at move 1, and want to go up to move 15, that's 14 full moves (28 plies).
  const startPly = rootChess.history().length;
  const targetPly = maxFullMoves * 2;
  const pliesLeft = Math.max(0, targetPly - startPly);

  queue.push({ node: rootNode, plyToProcess: pliesLeft });

  // Calculate total expected nodes for progress bar (rough estimate).
  // Root -> Opponent (5) -> User (1) -> Opponent (1) -> User (1)...
  let totalExpected = 1;
  let plies = pliesLeft;
  let currentTurn = rootNode.turn;
  
  if (plies > 0) {
    let branches = 1;
    for (let i = 0; i < plies; i++) {
      if (currentTurn !== userColor) {
        // First opponent turn splits into 5, subsequent opponent turns split into 1
        if (i === 0 || (i === 1 && currentTurn !== userColor)) { 
          // Wait, if user is White, user plays first. 
          // Turn 1: user (1), Turn 2: opp (5). Turn 3: user (1) * 5...
          // If turn === userColor, branches *= 1.
          // If turn !== userColor, branches *= 5 ONLY if it's the very first time the opponent plays in the tree.
        }
      }
    }
  }
  
  // Better: just dynamically update total nodes.
  let completedNodes = 0;
  let totalNodes = 1; // root

  let firstOpponentTurnSeen = false;

  const processQueue = async () => {
    while (queue.length > 0) {
      const { node, plyToProcess } = queue.shift()!;
      completedNodes++;
      onProgress(completedNodes, totalNodes);

      if (plyToProcess <= 0) continue;

      const chess = new Chess(node.fen);
      const isUserTurn = chess.turn() === userColor;

      if (isUserTurn) {
        // Stockfish gets 1 best move
        const uciMove = await evaluateStockfish(node.fen);
        if (uciMove) {
          const from = uciMove.substring(0, 2);
          const to = uciMove.substring(2, 4);
          const promotion = uciMove.length > 4 ? uciMove.substring(4) : undefined;
          
          try {
            const moveObj = chess.move({ from, to, promotion });
            const childNode: BuilderNode = {
              id: node.id + '-' + moveObj.san,
              fen: chess.fen(),
              moveSan: moveObj.san,
              turn: chess.turn(),
              source: 'stockfish',
              children: []
            };
            node.children.push(childNode);
            totalNodes++;
            queue.push({ node: childNode, plyToProcess: plyToProcess - 1 });
          } catch(e) {
            console.error("Invalid stockfish move:", uciMove);
          }
        }
      } else {
        // Opponent turn: Maia gets 5 moves if it's the first split, else 1
        // We'll mark the first split if the root node has no children OR if this is the first time we query Maia.
        const isFirstSplit = !firstOpponentTurnSeen;
        firstOpponentTurnSeen = true;

        const multipv = isFirstSplit ? 5 : 1;
        
        try {
          const res = await fetch('/api/maia', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fen: node.fen, rating: 1500, multipv })
          });
          const data = await res.json();
          
          const moves = data.moves || [];
          
          for (const m of moves) {
            const tempChess = new Chess(node.fen);
            const uciMove = m.move;
            const from = uciMove.substring(0, 2);
            const to = uciMove.substring(2, 4);
            const promotion = uciMove.length > 4 ? uciMove.substring(4) : undefined;
            
            try {
              const moveObj = tempChess.move({ from, to, promotion });
              const childNode: BuilderNode = {
                id: node.id + '-' + moveObj.san,
                fen: tempChess.fen(),
                moveSan: moveObj.san,
                turn: tempChess.turn(),
                source: 'maia',
                prob: m.prob,
                children: []
              };
              node.children.push(childNode);
              totalNodes++;
              queue.push({ node: childNode, plyToProcess: plyToProcess - 1 });
            } catch(e) {
              console.error("Invalid maia move:", uciMove);
            }
          }
        } catch(e) {
          console.error("Maia API error", e);
        }
      }
      
      onProgress(completedNodes, totalNodes);
    }
  };

  await processQueue();
  
  return rootNode;
}
