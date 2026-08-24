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

export type RockPaperScissorsChoice = 'rock' | 'paper' | 'scissors';

export interface RockPaperScissorsRound {
  playerXChoice: RockPaperScissorsChoice;
  playerOChoice: RockPaperScissorsChoice;
  winnerUserId: string | null;
}

export interface RockPaperScissorsGame {
  type: 'rockPaperScissors';
  version: 1;
  gameId: string;
  playerXUserId: string;
  playerOUserId: string;
  playerXChoice: RockPaperScissorsChoice | null;
  playerOChoice: RockPaperScissorsChoice | null;
  rounds?: RockPaperScissorsRound[];
  playerXScore?: number;
  playerOScore?: number;
  roundFirstPlayerUserId?: string;
  nextPlayerUserId: string | null;
  status: TicTacToeStatus;
  winnerUserId: string | null;
  moveNumber: number;
}

export type CodeSymbol = 'star' | 'heart' | 'circle' | 'square' | 'triangle' | 'hexagon';

export interface CodeGuess {
  symbols: CodeSymbol[];
  exact: number;
  misplaced: number;
}

export interface CodeGame {
  type: 'code';
  version: 1;
  gameId: string;
  codeMakerUserId: string;
  codeBreakerUserId: string;
  /** The secret is encrypted exclusively with the code maker's public key. */
  encryptedSecret: string;
  /** Encrypted for the code breaker's device so guesses can be evaluated locally without waiting. */
  encryptedSecretForCodeBreaker?: string;
  /** SHA-256 of the original code and nonce, allowing verification after reveal. */
  commitment: string;
  guesses: CodeGuess[];
  pendingGuess: CodeSymbol[] | null;
  revealedCode: CodeSymbol[] | null;
  revealNonce: string | null;
  nextPlayerUserId: string | null;
  status: 'active' | 'won';
  winnerUserId: string | null;
  moveNumber: number;
}

export type MemorySymbol = 'pets' | 'forest' | 'star' | 'favorite' | 'music_note' | 'flight' | 'restaurant' | 'sports_soccer';

export interface MemoryLastMove {
  playerUserId: string;
  cardIndices: [number, number];
  matched: boolean;
  moveNumber: number;
}

export interface MemoryGame {
  type: 'memory';
  version: 1;
  gameId: string;
  cards: MemorySymbol[];
  matchedBy: TicTacToeCell[];
  playerXUserId: string;
  playerOUserId: string;
  nextPlayerUserId: string | null;
  status: TicTacToeStatus;
  winnerUserId: string | null;
  moveNumber: number;
  lastMove: MemoryLastMove | null;
}

export interface MinefieldLastMove {
  playerUserId: string;
  cellIndex: number;
  hitMine: boolean;
  adjacentMines: number;
  moveNumber: number;
}

export interface MinefieldGame {
  type: 'minefield';
  version: 1;
  gameId: string;
  rows: 8;
  columns: 8;
  mines: boolean[];
  revealedBy: TicTacToeCell[];
  playerXUserId: string;
  playerOUserId: string;
  playerXScore: number;
  playerOScore: number;
  nextPlayerUserId: string | null;
  status: TicTacToeStatus;
  winnerUserId: string | null;
  moveNumber: number;
  lastMove: MinefieldLastMove | null;
}

export interface MinefieldHideSeekRound {
  hiderUserId: string;
  seekerUserId: string;
  mines: boolean[];
  revealed: boolean[];
  mistakes: number;
  /** True when the seeker revealed every mine before clearing all safe cells. */
  lost?: boolean;
  lastMove: MinefieldLastMove | null;
}

export interface MinefieldHideSeekGame {
  type: 'minefieldHideSeek';
  version: 1;
  gameId: string;
  rows: 6;
  columns: 6;
  playerXUserId: string;
  playerOUserId: string;
  phase: 'searchingFirst' | 'placingSecond' | 'searchingSecond' | 'finished';
  rounds: MinefieldHideSeekRound[];
  nextPlayerUserId: string | null;
  status: TicTacToeStatus;
  winnerUserId: string | null;
  moveNumber: number;
}

export type MorrisPhase = 'placing' | 'moving' | 'removing';
export interface MorrisMove { playerUserId:string; from:number|null; to:number|null; removed:number|null; moveNumber:number; }
export interface MorrisGame {
  type:'morris'; version:1; gameId:string; board:TicTacToeCell[];
  playerXUserId:string; playerOUserId:string; inHandX:number; inHandO:number;
  phase:MorrisPhase; nextPlayerUserId:string|null; status:TicTacToeStatus;
  winnerUserId:string|null; moveNumber:number; lastMove:MorrisMove|null;
}

export interface CheckersPiece { mark:TicTacToeMark; king:boolean; }
export interface CheckersLastMove {
  playerUserId:string;from:number;to:number;captured:number|null;moveNumber:number;
  /** Complete route of the turn; optional for compatibility with existing game messages. */
  turnPath?:number[];
  /** Pieces captured during the complete turn, retained for the opponent's preview. */
  capturedPieces?:{index:number;piece:CheckersPiece}[];
}
export interface CheckersGame {
  type:'checkers';version:1;gameId:string;board:(CheckersPiece|null)[];
  playerXUserId:string;playerOUserId:string;nextPlayerUserId:string|null;
  forcedPieceIndex:number|null;status:TicTacToeStatus;winnerUserId:string|null;
  moveNumber:number;lastMove:CheckersLastMove|null;
}

export type AsteroidDirection = 'up' | 'right' | 'down' | 'left';
export type AsteroidDuelAction = { type:'move'; to:number } | { type:'fire'; direction:AsteroidDirection };
export interface AsteroidDuelLastMove {
  playerUserId:string;
  action:AsteroidDuelAction;
  from:number;
  to:number;
  path:number[];
  destroyedAsteroid:number|null;
  hitPlayer:boolean;
  moveNumber:number;
}
export interface AsteroidDuelGame {
  type:'asteroidDuel';version:1;gameId:string;rows:7;columns:7;
  asteroids:boolean[];playerXUserId:string;playerOUserId:string;
  playerXPosition:number;playerOPosition:number;playerXShield:number;playerOShield:number;
  nextPlayerUserId:string|null;status:'active'|'won';winnerUserId:string|null;
  moveNumber:number;lastMove:AsteroidDuelLastMove|null;
}

export type TreasureIslandItem='treasure'|'bomb'|'prisoner'|'wine'|'bride'|'map'|'compass';
export type TreasureCompassDirection='up'|'upRight'|'right'|'downRight'|'down'|'downLeft'|'left'|'upLeft'|'here';
export type TreasureMapAction={type:'raid';cellIndices:number[]}|{type:'parrot';cellIndex:number}|{type:'pass'};
export interface TreasureMapLastMove{
  playerUserId:string;action:TreasureMapAction;foundItems:TreasureIslandItem[];
  temporaryRevealIndices:number[];mapRevealIndex:number|null;compassDirection:TreasureCompassDirection|null;moveNumber:number;
}
export interface TreasureMapGame{
  type:'treasureMap';version:1;gameId:string;rows:7;columns:7;
  playerXUserId:string;playerOUserId:string;playerXLayout:(TreasureIslandItem|null)[];playerOLayout:(TreasureIslandItem|null)[]|null;
  playerXRevealed:boolean[];playerORevealed:boolean[];playerXPirates:number;playerOPirates:number;
  playerXAttacked?:boolean[];playerOAttacked?:boolean[];
  playerXScouted?:boolean[];playerOScouted?:boolean[];
  playerXParrots:number;playerOParrots:number;playerXDrunk:number;playerODrunk:number;
  playerXTreasures:number;playerOTreasures:number;phase:'placingO'|'active';nextPlayerUserId:string|null;
  planningPlayerUserId?:string|null;
  status:'active'|'won';winnerUserId:string|null;moveNumber:number;lastMove:TreasureMapLastMove|null;
}

export type ChatGame = TicTacToeGame | ConnectFourGame | DotsAndBoxesGame | RockPaperScissorsGame | CodeGame | MemoryGame | MinefieldGame | MinefieldHideSeekGame | MorrisGame | CheckersGame | AsteroidDuelGame | TreasureMapGame;

export interface GameStats {
  played: number;
  won: number;
  lost: number;
  drawn: number;
}

export type TicTacToeStats = GameStats;
