import { Chess } from 'chess.js';
import { BuilderNode } from './builder';

export type RepertoireNode = {
  id?: string;
  san: string;
  fen: string;
  count: number;
  ply?: number;
  comment?: string;
  children: RepertoireNode[];
};

export type DecompiledLine = {
  id: string;
  name: string;
  moves: string[];
  nodes: RepertoireNode[];
  formattedPgn: string;
  fenEnd: string;
};

/**
 * Parses flat games (e.g. from Chess.com) into a frequency move tree.
 */
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
      try {
        tempChess.move(moveSan);
      } catch {
        break;
      }
      const fen = tempChess.fen();

      if (!currentLevel[moveSan]) {
        currentLevel[moveSan] = {
          san: moveSan,
          fen: fen,
          count: 0,
          children: []
        };
      }
      
      currentLevel[moveSan].count += 1;
      
      if (!(currentLevel[moveSan] as any)._childrenMap) {
        (currentLevel[moveSan] as any)._childrenMap = {};
      }
      currentLevel = (currentLevel[moveSan] as any)._childrenMap;
    }
  }

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

/**
 * Advanced Multi-Variation PGN Tree Parser
 * Correctly parses multi-level nested parenthetical variations `(...)`, comments `{...}`, NAGs `$1`,
 * and constructs a full branched Repertoire Move Tree.
 */
export function parseRepertoirePgnToTree(pgnText: string): { root: RepertoireNode; lines: DecompiledLine[] } {
  // 1. Strip PGN headers
  let body = pgnText.replace(/\[.*?\]/g, '').trim();
  body = body.replace(/(\*|1-0|0-1|1\/2-1\/2)\s*$/, '').trim();

  // 2. Tokenize moves and parenthetical variations
  const tokenPattern = /(\()|(\))|(\{.*?\})|(\$\d+)|([0-9]+\.+)|([a-zA-Z0-9+#=_-]+)/g;
  let tokens: { type: string; val?: string }[] = [];
  let match;

  while ((match = tokenPattern.exec(body)) !== null) {
    if (match[1]) tokens.push({ type: 'open_paren' });
    else if (match[2]) tokens.push({ type: 'close_paren' });
    else if (match[3]) tokens.push({ type: 'comment', val: match[3] });
    else if (match[4]) tokens.push({ type: 'nag', val: match[4] });
    else if (match[5]) tokens.push({ type: 'move_num', val: match[5] });
    else if (match[6]) tokens.push({ type: 'san', val: match[6] });
  }

  // Internal tree builder with chess board simulation
  class InternalNode {
    san: string;
    fen: string;
    parent: InternalNode | null;
    children: InternalNode[] = [];
    comment: string = '';
    ply: number = 0;
    chess: Chess;

    constructor(san: string, parent: InternalNode | null, ply: number, fen: string, chess: Chess) {
      this.san = san;
      this.parent = parent;
      this.ply = ply;
      this.fen = fen;
      this.chess = chess;
    }
  }

  const initialChess = new Chess();
  const root = new InternalNode("START", null, 0, initialChess.fen(), initialChess);
  let stack: InternalNode[] = [root];

  for (const token of tokens) {
    let curr = stack[stack.length - 1];

    if (token.type === 'open_paren') {
      // Variation starts from parent of current branch node
      stack.push(curr.parent ? curr.parent : root);
    } else if (token.type === 'close_paren') {
      if (stack.length > 1) {
        stack.pop();
      }
    } else if (token.type === 'comment' && token.val) {
      if (curr) curr.comment = token.val.replace(/[{}]/g, '').trim();
    } else if (token.type === 'san' && token.val) {
      // Validate and play move on current board state
      const nextChess = new Chess(curr.fen);
      try {
        const moveRes = nextChess.move(token.val);
        if (moveRes) {
          const node = new InternalNode(moveRes.san, curr, curr.ply + 1, nextChess.fen(), nextChess);
          curr.children.push(node);
          stack[stack.length - 1] = node;
        }
      } catch (err) {
        // Fallback for non-standard SAN
        const node = new InternalNode(token.val, curr, curr.ply + 1, curr.fen, nextChess);
        curr.children.push(node);
        stack[stack.length - 1] = node;
      }
    }
  }

  // Convert InternalNode to clean RepertoireNode
  function convertNode(internal: InternalNode, idPrefix: string = '0'): RepertoireNode {
    return {
      id: idPrefix,
      san: internal.san,
      fen: internal.fen,
      count: internal.children.length,
      ply: internal.ply,
      comment: internal.comment,
      children: internal.children.map((c, i) => convertNode(c, `${idPrefix}-${i}`)),
    };
  }

  const cleanRoot = convertNode(root);

  // Extract all distinct lines (root -> leaf)
  const lines: DecompiledLine[] = [];

  function dfs(node: InternalNode, path: InternalNode[]) {
    if (!node.children || node.children.length === 0) {
      if (path.length > 0) {
        const moveSans = path.map(n => n.san);
        const formatted = formatMovePath(moveSans);
        const name = identifyVariationName(moveSans, lines.length + 1);
        lines.push({
          id: `line-${lines.length + 1}`,
          name,
          moves: moveSans,
          nodes: path.map(p => ({ san: p.san, fen: p.fen, count: 1, ply: p.ply, comment: p.comment, children: [] })),
          formattedPgn: formatted,
          fenEnd: node.fen,
        });
      }
      return;
    }
    for (const child of node.children) {
      dfs(child, [...path, child]);
    }
  }

  dfs(root, []);

  return { root: cleanRoot, lines };
}

/**
 * Formats a linear list of SAN moves into standard PGN move numbering (1. e4 e5 2. Nf3 ...)
 */
export function formatMovePath(moves: string[]): string {
  const result: string[] = [];
  moves.forEach((san, idx) => {
    const ply = idx + 1;
    const moveNum = Math.ceil(ply / 2);
    if (ply % 2 === 1) {
      result.push(`${moveNum}. ${san}`);
    } else {
      result.push(san);
    }
  });
  return result.join(' ');
}

/**
 * Heuristic opening classifier based on move signature
 */
export function identifyVariationName(moves: string[], lineIndex: number): string {
  const full = moves.join(' ');
  if (full.includes('d4 exd4') && full.includes('Bc5')) return 'Scotch: Classical (4...Bc5)';
  if (full.includes('d4 exd4') && full.includes('Nf6 5. Nc3 Bb4')) return 'Scotch: Mieses (4...Nf6 5.Nc3 Bb4)';
  if (full.includes('d4 exd4') && full.includes('Nxd4 5. Qxd4')) return 'Scotch: 4...Nxd4 5.Qxd4';
  if (full.includes('d4 d6')) return 'Scotch: 3...d6 Philidor Transposition';
  if (full.includes('d4 Nf6')) return 'Scotch: 3...Nf6 Counter';
  if (full.includes('d4 f6')) return 'Scotch: 3...f6';
  if (full.includes('d4 d5')) return 'Scotch: 3...d5 Countergambit';
  if (full.includes('d4 Bb4+')) return 'Scotch: 3...Bb4+';
  if (full.includes('e4 c5')) return 'Sicilian Defense';
  if (full.includes('e4 e6')) return 'French Defense';
  if (full.includes('e4 c6')) return 'Caro-Kann Defense';
  return `Repertoire Line ${lineIndex}`;
}

/**
 * Converts a RepertoireNode tree into a BuilderNode tree for ReactFlow / RepertoireGraph
 */
export function convertRepertoireNodeToBuilderNode(repNode: RepertoireNode, id: string = 'root'): BuilderNode {
  return {
    id,
    fen: repNode.fen,
    moveSan: repNode.san === 'START' ? 'Root' : repNode.san,
    turn: repNode.fen.split(' ')[1] as 'w' | 'b',
    source: repNode.san === 'START' ? 'root' : (repNode.ply && repNode.ply % 2 === 1 ? 'stockfish' : 'maia'),
    children: repNode.children.map((c, idx) => convertRepertoireNodeToBuilderNode(c, `${id}-${idx}`)),
  };
}
