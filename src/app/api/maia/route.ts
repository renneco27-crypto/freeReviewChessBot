import { NextRequest, NextResponse } from 'next/server';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import path from 'path';

// ─── Persistent Engine Singleton ────────────────────────────────────────────
// We keep ONE lc0 process alive for the entire session rather than spawning
// a new one per request. This eliminates the ~1-2s cold-start per move.

type EngineState = {
  process: ChildProcessWithoutNullStreams | null;
  ready: boolean;
  rating: number;
  outputBuffer: string;
  pendingResolve: ((result: { bestMove: string; moves: { move: string; prob: number }[] }) => void) | null;
  moveMap: Map<number, string>;
  currentDepth: number;
};

// globalThis persists across hot-reloads in Next.js dev and between API requests
const g = globalThis as any;
if (!g._maiaEngine) {
  g._maiaEngine = {
    process: null,
    ready: false,
    rating: -1,
    outputBuffer: '',
    pendingResolve: null,
    moveMap: new Map(),
    currentDepth: 0,
  } as EngineState;
}
const engine: EngineState = g._maiaEngine;

function startEngine(rating: number): Promise<void> {
  return new Promise((resolve, reject) => {
    // Kill existing process if rating changed
    if (engine.process && engine.rating !== rating) {
      engine.process.kill();
      engine.process = null;
      engine.ready = false;
    }

    if (engine.process && engine.ready) {
      resolve();
      return;
    }

    const enginePath = path.join(process.cwd(), 'bin', 'lc0', 'lc0.exe');
    const weightsPath = path.join(process.cwd(), 'bin', `maia-${rating}.pb.gz`);

    const lc0 = spawn(enginePath, []);
    engine.process = lc0;
    engine.rating = rating;
    engine.ready = false;
    engine.outputBuffer = '';
    engine.pendingResolve = null;

    lc0.stdout.on('data', (data: Buffer) => {
      engine.outputBuffer += data.toString();
      let newlineIndex: number;
      while ((newlineIndex = engine.outputBuffer.indexOf('\n')) !== -1) {
        const line = engine.outputBuffer.slice(0, newlineIndex).trim();
        engine.outputBuffer = engine.outputBuffer.slice(newlineIndex + 1);
        if (!line) continue;

        if (line === 'readyok' && !engine.ready) {
          engine.ready = true;
          resolve();
          return;
        }

        if (engine.pendingResolve) {
          if (line.startsWith('info depth')) {
            const parts = line.split(' ');
            const depthIndex = parts.indexOf('depth');
            const multipvIndex = parts.indexOf('multipv');
            const pvIndex = parts.indexOf('pv');
            if (depthIndex !== -1 && multipvIndex !== -1 && pvIndex !== -1 && pvIndex + 1 < parts.length) {
              const depth = parseInt(parts[depthIndex + 1], 10);
              const mPv = parseInt(parts[multipvIndex + 1], 10);
              const move = parts[pvIndex + 1];
              if (depth > engine.currentDepth) {
                engine.currentDepth = depth;
                engine.moveMap.clear();
              }
              if (depth === engine.currentDepth) {
                engine.moveMap.set(mPv, move);
              }
            }
          } else if (line.startsWith('bestmove')) {
            const parts = line.split(' ');
            const bestMove = parts[1] || '';
            let moves = Array.from(engine.moveMap.entries())
              .sort((a, b) => a[0] - b[0])
              .map(entry => ({ move: entry[1], prob: 1.0 / entry[0] }));
            if (moves.length === 0 && bestMove) {
              moves.push({ move: bestMove, prob: 1.0 });
            }
            const resolver = engine.pendingResolve;
            engine.pendingResolve = null;
            resolver?.({ bestMove, moves });
          }
        }
      }
    });

    lc0.stderr.on('data', () => {}); // suppress stderr noise

    lc0.on('close', () => {
      engine.process = null;
      engine.ready = false;
      engine.pendingResolve?.({ bestMove: '', moves: [] });
      engine.pendingResolve = null;
    });

    lc0.stdin.write('uci\n');
    lc0.stdin.write(`setoption name WeightsFile value ${weightsPath}\n`);
    lc0.stdin.write('isready\n');
  });
}

function queryEngine(fen: string, multipv: number): Promise<{ bestMove: string; moves: { move: string; prob: number }[] }> {
  return new Promise((resolve) => {
    if (!engine.process || !engine.ready) {
      resolve({ bestMove: '', moves: [] });
      return;
    }
    // Reset state for new query
    engine.moveMap.clear();
    engine.currentDepth = 0;
    engine.pendingResolve = resolve;

    if (multipv > 1) {
      engine.process.stdin.write(`setoption name MultiPV value ${multipv}\n`);
    } else {
      engine.process.stdin.write(`setoption name MultiPV value 1\n`);
    }
    engine.process.stdin.write(`position fen ${fen}\n`);
    // CRITICAL: Always use nodes 1 — pure Maia policy without MCTS search
    engine.process.stdin.write(`go nodes 1\n`);
  });
}

// ─── API Route ───────────────────────────────────────────────────────────────
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { fen, rating = 1500, multipv = 1, action } = await request.json();

    // Kill engine session (called on stop/clear)
    if (action === 'kill') {
      if (engine.process) {
        engine.process.kill();
        engine.process = null;
        engine.ready = false;
      }
      return NextResponse.json({ ok: true });
    }

    await startEngine(rating);
    const result = await queryEngine(fen, multipv);

    if (!result.bestMove) {
      return NextResponse.json({ error: 'Engine failed to find a move' }, { status: 500 });
    }

    return NextResponse.json({ bestMove: result.bestMove, moves: result.moves });
  } catch (error: any) {
    console.error('Maia API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
