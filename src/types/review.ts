export type MoveClassification = 
  | 'brilliant'
  | 'great'
  | 'best'
  | 'excellent'
  | 'good'
  | 'book'
  | 'inaccuracy'
  | 'mistake'
  | 'miss'
  | 'blunder';

export interface MoveAnalysis {
  moveNumber: number;
  ply: number;
  color: 'w' | 'b';
  san: string;
  uci: string;
  from: string;
  to: string;
  fenBefore: string;
  fenAfter: string;
  evalBefore: number; // centipawns (from white's perspective)
  evalAfter: number; // centipawns (from white's perspective)
  mateBefore?: number;
  mateAfter?: number;
  bestMoveSan?: string;
  bestMoveUci?: string;
  bestMoveEval?: number;
  classification: MoveClassification;
  winProbBefore: number;
  winProbAfter: number;
  winProbLoss: number;
  clockTime?: string; // remaining time string e.g. 02:45
  secondsSpent?: number;
  coachCommentary?: string;
  threatDetails?: string;
  isKeyMoment?: boolean;
}

export interface GameReviewReport {
  whiteAccuracy: number;
  blackAccuracy: number;
  whitePlayer: string;
  blackPlayer: string;
  whiteRating?: number;
  blackRating?: number;
  result: string; // '1-0' | '0-1' | '1/2-1/2' | '*'
  timeControl?: string;
  date?: string;
  eco?: string;
  openingName?: string;
  moves: MoveAnalysis[];
  keyMomentsCount: number;
  stats: {
    white: Record<MoveClassification, number>;
    black: Record<MoveClassification, number>;
    phaseAccuracy: {
      opening: { white: number; black: number };
      middlegame: { white: number; black: number };
      endgame: { white: number; black: number };
    };
  };
}

export interface ChessComGameSummary {
  url: string;
  pgn: string;
  time_control: string;
  end_time: number;
  rated: boolean;
  time_class: 'bullet' | 'blitz' | 'rapid' | 'daily';
  rules: string;
  white: {
    username: string;
    rating: number;
    result: string;
    uuid?: string;
  };
  black: {
    username: string;
    rating: number;
    result: string;
    uuid?: string;
  };
}
