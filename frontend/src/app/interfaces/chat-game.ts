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

export type ConnectFourCell = 'R' | 'Y' | null;
export type ConnectFourVariant = 'standard' | 'vanishing';

export interface ConnectFourMove {
  mark: Exclude<ConnectFourCell, null>;
  cellIndex: number;
}

export interface ConnectFourGame {
  type: 'connectFour';
  version: 1;
  gameId: string;
  board: ConnectFourCell[];
  playerRedUserId: string;
  playerYellowUserId: string;
  nextPlayerUserId: string | null;
  status: TicTacToeStatus;
  winnerUserId: string | null;
  moveNumber: number;
  /** Missing on existing production messages and therefore treated as standard. */
  variant?: ConnectFourVariant;
  /** Current placements in chronological order; used by the vanishing variant. */
  moves?: ConnectFourMove[];
}

export type DotsAndBoxesEdgeOrientation = 'horizontal' | 'vertical';

export interface DotsAndBoxesMove {
  orientation: DotsAndBoxesEdgeOrientation;
  index: number;
}

export interface DotsAndBoxesGame {
  type: 'dotsAndBoxes';
  version: 1;
  gameId: string;
  horizontalEdges: boolean[];
  verticalEdges: boolean[];
  /** Owners are optional for compatibility with game messages created before colored edges existed. */
  horizontalEdgeOwners?: TicTacToeCell[];
  verticalEdgeOwners?: TicTacToeCell[];
  boxes: TicTacToeCell[];
  playerXUserId: string;
  playerOUserId: string;
  nextPlayerUserId: string | null;
  status: TicTacToeStatus;
  winnerUserId: string | null;
  moveNumber: number;
}

export type ChatGame = TicTacToeGame | ConnectFourGame | DotsAndBoxesGame;

export interface GameStats {
  played: number;
  won: number;
  lost: number;
  drawn: number;
}

export type TicTacToeStats = GameStats;
