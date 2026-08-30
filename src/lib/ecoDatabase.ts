export interface OpeningInfo {
  eco: string;
  name: string;
  moves: string[];
}

export const ECO_DATABASE: OpeningInfo[] = [
  { eco: 'B90', name: 'Sicilian Defense: Najdorf Variation', moves: ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'a6'] },
  { eco: 'B33', name: 'Sicilian Defense: Sveshnikov Variation', moves: ['e4', 'c5', 'Nf3', 'Nc6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'e5'] },
  { eco: 'B20', name: 'Sicilian Defense', moves: ['e4', 'c5'] },
  { eco: 'C60', name: 'Ruy Lopez (Spanish Opening)', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'] },
  { eco: 'C50', name: 'Italian Game (Giuoco Piano)', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'] },
  { eco: 'C55', name: 'Two Knights Defense', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6'] },
  { eco: 'C45', name: 'Scotch Game', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'd4'] },
  { eco: 'C42', name: 'Petrov Defense (Russian Game)', moves: ['e4', 'e5', 'Nf3', 'Nf6'] },
  { eco: 'C00', name: 'French Defense', moves: ['e4', 'e6'] },
  { eco: 'C10', name: 'French Defense: Paulsen Variation', moves: ['e4', 'e6', 'd4', 'd5', 'Nc3'] },
  { eco: 'B10', name: 'Caro-Kann Defense', moves: ['e4', 'c6'] },
  { eco: 'B12', name: 'Caro-Kann Defense: Advance Variation', moves: ['e4', 'c6', 'd4', 'd5', 'e5'] },
  { eco: 'B01', name: 'Scandinavian Defense', moves: ['e4', 'd5'] },
  { eco: 'B06', name: 'Modern Defense', moves: ['e4', 'g6'] },
  { eco: 'B07', name: 'Pirc Defense', moves: ['e4', 'd6', 'd4', 'Nf6'] },
  { eco: 'C30', name: "King's Gambit", moves: ['e4', 'e5', 'f4'] },
  { eco: 'C20', name: "King's Pawn Game", moves: ['e4', 'e5'] },
  { eco: 'D30', name: "Queen's Gambit Declined", moves: ['d4', 'd5', 'c4', 'e6'] },
  { eco: 'D20', name: "Queen's Gambit Accepted", moves: ['d4', 'd5', 'c4', 'dxc4'] },
  { eco: 'D06', name: "Queen's Gambit", moves: ['d4', 'd5', 'c4'] },
  { eco: 'D02', name: 'London System', moves: ['d4', 'd5', 'Nf3', 'Nf6', 'Bf4'] },
  { eco: 'D00', name: "Queen's Pawn Game", moves: ['d4', 'd5'] },
  { eco: 'E60', name: "King's Indian Defense", moves: ['d4', 'Nf6', 'c4', 'g6'] },
  { eco: 'E20', name: 'Nimzo-Indian Defense', moves: ['d4', 'Nf6', 'c4', 'e6', 'Nc3', 'Bb4'] },
  { eco: 'E12', name: "Queen's Indian Defense", moves: ['d4', 'Nf6', 'c4', 'e6', 'Nf3', 'b6'] },
  { eco: 'E00', name: 'Catalan Opening', moves: ['d4', 'Nf6', 'c4', 'e6', 'g3'] },
  { eco: 'A57', name: 'Benko Gambit', moves: ['d4', 'Nf6', 'c4', 'c5', 'd5', 'b5'] },
  { eco: 'A80', name: 'Dutch Defense', moves: ['d4', 'f5'] },
  { eco: 'A45', name: 'Trompowsky Attack', moves: ['d4', 'Nf6', 'Bg5'] },
  { eco: 'A10', name: 'English Opening', moves: ['c4'] },
  { eco: 'A04', name: 'Reti Opening', moves: ['Nf3'] },
  { eco: 'A02', name: "Bird's Opening", moves: ['f4'] }
];

export function identifyOpening(sanMoves: string[]): { eco: string; name: string; bookMovesCount: number } {
  let matchedOpening: OpeningInfo | null = null;
  let maxMatchedMoves = 0;

  for (const opening of ECO_DATABASE) {
    let match = true;
    for (let i = 0; i < opening.moves.length; i++) {
      if (i >= sanMoves.length || sanMoves[i] !== opening.moves[i]) {
        match = false;
        break;
      }
    }
    if (match && opening.moves.length > maxMatchedMoves) {
      matchedOpening = opening;
      maxMatchedMoves = opening.moves.length;
    }
  }

  if (matchedOpening) {
    return {
      eco: matchedOpening.eco,
      name: matchedOpening.name,
      bookMovesCount: matchedOpening.moves.length
    };
  }

  return {
    eco: 'A00',
    name: 'Standard Chess Game',
    bookMovesCount: 0
  };
}
