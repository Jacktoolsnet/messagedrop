import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { CodeGame, CodeSymbol } from '../../../interfaces/chat-game';
import { CryptoData } from '../../../interfaces/crypto-data';
import { CryptoService } from '../../../services/crypto.service';
import { GameFeedbackService } from '../../../services/game-feedback.service';
import { UserService } from '../../../services/user.service';
import { CODE_LENGTH, CODE_MAX_GUESSES, CODE_SYMBOLS, createCodeCommitment, isValidCode } from '../../../utils/code-game';

@Component({
  selector: 'app-code-board',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, TranslocoPipe],
  templateUrl: './code-board.component.html',
  styleUrl: './code-board.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CodeBoardComponent {
  private readonly cryptoService = inject(CryptoService);
  private readonly userService = inject(UserService);
  private readonly feedback = inject(GameFeedbackService);
  private makerSecretCiphertext = '';
  private decryptedMakerCode: CodeSymbol[] | null = null;
  readonly game = input<CodeGame | null>(null);
  readonly currentUserId = input('');
  readonly selectionMode = input(false);
  readonly disabled = input(false);
  readonly initialSelection = input<CodeSymbol[]>([]);
  readonly guess = output<CodeSymbol[]>();
  readonly evaluate = output<void>();
  readonly selectionChange = output<CodeSymbol[]>();
  readonly symbols = CODE_SYMBOLS;
  readonly maxGuesses = CODE_MAX_GUESSES;
  readonly selection = signal<CodeSymbol[]>([]);
  readonly commitmentVerified = signal<boolean | null>(null);
  readonly makerCode = signal<CodeSymbol[] | null>(null);
  readonly showMakerCode = signal(false);
  readonly visibleCode = computed(() => this.game()?.revealedCode
    ?? (this.showMakerCode() ? this.makerCode() : null));
  readonly canSubmit = computed(() => this.selection().length === CODE_LENGTH && !this.disabled());

  constructor() {
    effect(() => {
      const game = this.game();
      const currentUserId = this.currentUserId();
      if (!game || game.codeMakerUserId !== currentUserId) {
        this.makerSecretCiphertext = '';
        this.decryptedMakerCode = null;
        this.makerCode.set(null);
        return;
      }
      if (this.makerSecretCiphertext === game.encryptedSecret && this.decryptedMakerCode) {
        this.makerCode.set(this.decryptedMakerCode);
        return;
      }
      this.makerSecretCiphertext = game.encryptedSecret;
      this.decryptedMakerCode = null;
      this.makerCode.set(null);
      const gameId = game.gameId;
      void this.decryptMakerCode(game).then(code => {
        if (this.game()?.gameId === gameId && this.currentUserId() === currentUserId) {
          this.decryptedMakerCode = code;
          this.makerCode.set(code);
        }
      });
    });
    effect(() => {
      const game = this.game();
      if (!game?.revealedCode || !game.revealNonce) {
        this.commitmentVerified.set(null);
        return;
      }
      const expectedCommitment = game.commitment;
      void createCodeCommitment({ code: game.revealedCode, nonce: game.revealNonce })
        .then(commitment => this.commitmentVerified.set(commitment === expectedCommitment))
        .catch(() => this.commitmentVerified.set(false));
    });
  }

  private async decryptMakerCode(game: CodeGame): Promise<CodeSymbol[] | null> {
    try {
      const decrypted = await this.cryptoService.decrypt(
        this.userService.getUser().cryptoKeyPair.privateKey,
        JSON.parse(game.encryptedSecret) as CryptoData
      );
      const code = (JSON.parse(decrypted) as { code?: unknown }).code;
      return isValidCode(code) ? [...code] : null;
    } catch {
      return null;
    }
  }

  add(symbol: CodeSymbol): void {
    if (this.disabled() || this.selection().length >= CODE_LENGTH) return;
    this.feedback.notifySelection();
    this.updateSelection([...this.selection(), symbol]);
  }

  remove(index: number): void {
    if (this.disabled()) return;
    this.feedback.notifySelection();
    this.updateSelection(this.selection().filter((_, current) => current !== index));
  }

  clear(): void { this.updateSelection([]); }

  toggleMakerCode(): void {
    if (this.game()?.codeMakerUserId === this.currentUserId()) this.showMakerCode.update(value => !value);
  }

  submit(): void {
    if (!this.canSubmit()) return;
    this.guess.emit([...this.selection()]);
    if (!this.selectionMode()) this.updateSelection([]);
  }

  icon(symbol: CodeSymbol): string {
    return symbol === 'heart' ? 'favorite'
      : symbol === 'circle' ? 'circle'
        : symbol === 'square' ? 'square'
          : symbol === 'triangle' ? 'change_history'
            : symbol;
  }

  private updateSelection(value: CodeSymbol[]): void {
    this.selection.set(value);
    this.selectionChange.emit(value);
  }
}
