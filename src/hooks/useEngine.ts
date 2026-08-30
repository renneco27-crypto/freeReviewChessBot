import { useEffect, useRef, useState } from 'react';

export function useEngine() {
  const engineRef = useRef<Worker | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Initialize Web Worker
    // We use stockfish.js from the public directory
    const worker = new Worker('/stockfish.js');
    engineRef.current = worker;

    worker.onmessage = (e) => {
      const msg = e.data;
      if (msg === 'uciok') {
        setIsReady(true);
      }
    };

    worker.postMessage('uci');

    return () => {
      worker.terminate();
    };
  }, []);

  const evaluatePosition = (fen: string, depth = 15): Promise<string> => {
    return new Promise((resolve) => {
      const worker = engineRef.current;
      if (!worker) return resolve('');

      const messageHandler = (e: MessageEvent) => {
        const msg = e.data;
        if (typeof msg === 'string' && msg.startsWith('bestmove')) {
          const move = msg.split(' ')[1];
          worker.removeEventListener('message', messageHandler);
          resolve(move);
        }
      };

      worker.addEventListener('message', messageHandler);
      worker.postMessage(`position fen ${fen}`);
      worker.postMessage(`go depth ${depth}`);
    });
  };

  const evaluatePositionDetailed = (fen: string, depth = 15): Promise<{ bestMove: string; scoreCp: number; mate?: number }> => {
    return new Promise((resolve) => {
      const worker = engineRef.current;
      if (!worker) return resolve({ bestMove: '', scoreCp: 0 });

      let latestCp = 0;
      let latestMate: number | undefined;

      const messageHandler = (e: MessageEvent) => {
        const msg = e.data;
        if (typeof msg === 'string') {
          // Parse score cp
          const cpMatch = msg.match(/score cp (-?\d+)/);
          if (cpMatch) latestCp = parseInt(cpMatch[1]);

          // Parse score mate
          const mateMatch = msg.match(/score mate (-?\d+)/);
          if (mateMatch) latestMate = parseInt(mateMatch[1]);

          if (msg.startsWith('bestmove')) {
            const move = msg.split(' ')[1];
            worker.removeEventListener('message', messageHandler);
            resolve({ bestMove: move, scoreCp: latestCp, mate: latestMate });
          }
        }
      };

      worker.addEventListener('message', messageHandler);
      worker.postMessage(`position fen ${fen}`);
      worker.postMessage(`go depth ${depth}`);
    });
  };

  return { isReady, evaluatePosition, evaluatePositionDetailed };
}
