import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { fen, rating = 1500 } = await request.json();

    const enginePath = path.join(process.cwd(), 'bin', 'lc0', 'lc0.exe');
    const weightsPath = path.join(process.cwd(), 'bin', `maia-${rating}.pb.gz`);

    return new Promise((resolve) => {
      const lc0 = spawn(enginePath, []);

      let bestMove = '';
      let errorOutput = '';

      lc0.stdout.on('data', (data) => {
        const output = data.toString();
        
        // Find the bestmove line
        const lines = output.split('\n');
        for (const line of lines) {
          if (line.startsWith('bestmove')) {
            const parts = line.split(' ');
            if (parts.length >= 2) {
              bestMove = parts[1];
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
          resolve(NextResponse.json({ bestMove }));
        }
      });

      // Send standard UCI setup
      lc0.stdin.write('uci\n');
      lc0.stdin.write(`setoption name WeightsFile value ${weightsPath}\n`);
      lc0.stdin.write('isready\n');
      lc0.stdin.write(`position fen ${fen}\n`);
      
      // CRITICAL: We restrict it to 1 node to simulate human intuition (Maia's intended use case)
      lc0.stdin.write('go nodes 1\n');
    });

  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
