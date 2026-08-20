export type TicTacToeMark = 'X' | 'O';
export type TicTacToeCell = TicTacToeMark | null;
export type TicTacToeStatus = 'active' | 'won' | 'draw';
export type TicTacToeVariant = 'standard' | 'vanishing';

export interface TicTacToeMove {
  mark: TicTacToeMark;
  cellIndex: number;
}

export interface TicTacToeGame {
  type: 'ticTacToe';
  version: 1;
  gameId: string;
  board: TicTacToeCell[];
  playerXUserId: string;
  playerOUserId: string;
  nextPlayerUserId: string | null;
  status: TicTacToeStatus;
  winnerUserId: string | null;
  moveNumber: number;
  /** Missing on existing production messages and therefore treated as standard. */
  variant?: TicTacToeVariant;
  /** Current placements in chronological order; used by the vanishing variant. */
  moves?: TicTacToeMove[];
}

export type ChatGame = TicTacToeGame;

export interface TicTacToeStats {
  played: number;
  won: number;
  lost: number;
  drawn: number;
}
