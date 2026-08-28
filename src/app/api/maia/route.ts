import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { fen, rating = 1500, multipv = 1 } = await request.json();

    const enginePath = path.join(process.cwd(), 'bin', 'lc0', 'lc0.exe');
    const weightsPath = path.join(process.cwd(), 'bin', `maia-${rating}.pb.gz`);

    return new Promise((resolve) => {
      const lc0 = spawn(enginePath, []);

      let moves: { move: string, prob: number }[] = [];
      let bestMove = '';
      let errorOutput = '';
      let currentDepth = 0;

      // To capture multipv lines
      const moveMap = new Map<number, string>();

      let outputBuffer = '';
      lc0.stdout.on('data', (data) => {
        outputBuffer += data.toString();
        let newlineIndex;
        while ((newlineIndex = outputBuffer.indexOf('\n')) !== -1) {
          const line = outputBuffer.slice(0, newlineIndex).trim();
          outputBuffer = outputBuffer.slice(newlineIndex + 1);
          if (line.length === 0) continue;

          if (line.startsWith('info depth')) {
            const parts = line.split(' ');
            const depthIndex = parts.indexOf('depth');
            const multipvIndex = parts.indexOf('multipv');
            const pvIndex = parts.indexOf('pv');
            
            if (depthIndex !== -1 && multipvIndex !== -1 && pvIndex !== -1 && pvIndex + 1 < parts.length) {
              const depth = parseInt(parts[depthIndex + 1], 10);
              const mPv = parseInt(parts[multipvIndex + 1], 10);
              const move = parts[pvIndex + 1];

              // Update the map for the latest depth
              if (depth > currentDepth) {
                currentDepth = depth;
                moveMap.clear();
              }
              if (depth === currentDepth) {
                moveMap.set(mPv, move);
              }
            }
          } else if (line.startsWith('bestmove')) {
            const parts = line.split(' ');
            if (parts.length >= 2) {
              bestMove = parts[1];
            }
            
            // Build moves array based on the collected multipv lines
            moves = Array.from(moveMap.entries())
              .sort((a, b) => a[0] - b[0])
              .map(entry => ({ move: entry[1], prob: 1.0 / entry[0] })); // Dummy prob just to have ordering
            
            if (moves.length === 0 && bestMove) {
              moves.push({ move: bestMove, prob: 1.0 });
            }

            lc0.stdin.write('quit\n');
          }
        }
      });

      lc0.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      lc0.on('close', (code) => {
        if (!bestMove) {
          console.error('Lc0 closed without finding a move. Stderr:', errorOutput);
          resolve(NextResponse.json({ error: 'Engine failed to find a move' }, { status: 500 }));
        } else {
          // If they just want 1, we can just return bestMove for legacy compatibility
          // But now we return `moves` as well
          resolve(NextResponse.json({ bestMove, moves }));
        }
      });

      // Send standard UCI setup
      lc0.stdin.write('uci\n');
      lc0.stdin.write(`setoption name WeightsFile value ${weightsPath}\n`);
      if (multipv > 1) {
        lc0.stdin.write(`setoption name MultiPV value ${multipv}\n`);
      }
      lc0.stdin.write('isready\n');
      lc0.stdin.write(`position fen ${fen}\n`);
      
      // We must ALWAYS use exactly 1 node to simulate human intuition (Maia's intended use case)
      // Lc0 will still output multiple PVs from the root policy vector if multipv > 1
      lc0.stdin.write(`go nodes 1\n`);
    });

  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
