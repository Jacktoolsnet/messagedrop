import { CommonModule } from '@angular/common';
import { Component, HostListener, OnDestroy, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { TranslocoPipe } from '@jsverse/transloco';
import { DisplayMessage } from '../../utils/display-message/display-message.component';
import { TranslationHelperService } from '../../../services/translation-helper.service';
import { PinInputFeedbackService } from '../../../services/pin-input-feedback.service';

interface CreatePinDialogData {
  titleKey?: string;
  createHintKey?: string;
  confirmHintKey?: string;
}

@Component({
  selector: 'app-createpin',
  imports: [
    CommonModule,
    MatIcon,
    MatInputModule,
    MatButtonModule,
    TranslocoPipe
  ],
  templateUrl: './create-pin.component.html',
  styleUrl: './create-pin.component.css'
})
export class CreatePinComponent implements OnDestroy {
  pin = '';
  pinLength = 6;
  confirmPin = '';
  pinDisplay: string[] = ['', '', '', '', '', ''];
  confirmPinDisplay: string[] = ['', '', '', '', '', ''];
  pinPulseStates: boolean[] = [false, false, false, false, false, false];
  confirmPinPulseStates: boolean[] = [false, false, false, false, false, false];
  isConfirming = false;
  readonly digitVisibilityDurationMs = 550;
  readonly slotPulseDurationMs = 240;
  private dialogClosed = false;
  private readonly pinMaskTimeouts: Array<number | undefined> = new Array<number | undefined>(this.pinLength).fill(undefined);
  private readonly confirmPinMaskTimeouts: Array<number | undefined> = new Array<number | undefined>(this.pinLength).fill(undefined);
  private readonly pinPulseTimeouts: Array<number | undefined> = new Array<number | undefined>(this.pinLength).fill(undefined);
  private readonly confirmPinPulseTimeouts: Array<number | undefined> = new Array<number | undefined>(this.pinLength).fill(undefined);
  private transitionTimeoutId?: number;

  readonly data = inject<CreatePinDialogData | null>(MAT_DIALOG_DATA, { optional: true }) ?? {};

  private readonly dialogRef = inject(MatDialogRef<CreatePinComponent>);
  private readonly dialog = inject(MatDialog);
  private readonly translation = inject(TranslationHelperService);
  private readonly pinFeedback = inject(PinInputFeedbackService);

  ngOnDestroy(): void {
    this.dialogClosed = true;
    this.clearTransitionTimeout();
    this.clearAllSlotTimers();
  }

  @HostListener('document:keydown', ['$event'])
  handleKeyboardInput(event: KeyboardEvent): void {
    const key = event.key;

    if (/^[0-9]$/.test(key)) {
      this.addDigit(key);
    } else if (key === 'Backspace') {
      this.removeDigit();
    }
  }

  get currentPinIndex(): number {
    return this.isConfirming ? this.confirmPin.length : this.pin.length;
  }

  get titleKey(): string {
    return this.data.titleKey?.trim() || 'common.pin.title';
  }

  get currentHintKey(): string {
    if (this.isConfirming) {
      return this.data.confirmHintKey?.trim() || 'common.pin.confirmHint';
    }
    return this.data.createHintKey?.trim() || 'common.pin.createHint';
  }

  addDigit(digit: string): void {
    if (!this.isConfirming) {
      if (this.pin.length < this.pinLength) {
        const index = this.pin.length;
        this.pin += digit;
        this.showDigitTemporarily(index);
        this.pulseSlot(index);
        void this.pinFeedback.notifyAcceptedInput();

        if (this.pin.length === this.pinLength) {
          this.clearTransitionTimeout();
          this.transitionTimeoutId = window.setTimeout(() => {
            this.isConfirming = true;
          }, this.digitVisibilityDurationMs);
        }
      }
    } else {
      if (this.confirmPin.length < this.pinLength) {
        const index = this.confirmPin.length;
        this.confirmPin += digit;
        this.showDigitTemporarily(index, true);
        this.pulseSlot(index, true);
        void this.pinFeedback.notifyAcceptedInput();

        if (this.confirmPin.length === this.pinLength) {
          // Auto-check and close if it matches.
          this.clearTransitionTimeout();
          this.transitionTimeoutId = window.setTimeout(() => {
            if (this.confirmPin === this.pin && !this.dialogClosed) {
              this.dialogClosed = true;
              this.dialogRef.close(this.pin);
            } else {
              this.reset(false);
              this.showPinMismatchMessage();
            }
          }, this.digitVisibilityDurationMs);
        }
      }
    }
  }

  showDigitTemporarily(index: number, isConfirming = false): void {
    const displayArray = isConfirming ? this.confirmPinDisplay : this.pinDisplay;
    const timeoutArray = isConfirming ? this.confirmPinMaskTimeouts : this.pinMaskTimeouts;
    this.clearMaskTimeout(index, isConfirming);
    displayArray[index] = (isConfirming ? this.confirmPin : this.pin)[index];
    timeoutArray[index] = window.setTimeout(() => {
      if ((isConfirming ? this.confirmPin : this.pin).length > index) {
        displayArray[index] = '•';
      }
      timeoutArray[index] = undefined;
    }, this.digitVisibilityDurationMs);
  }

  removeDigit(): void {
    if (!this.isConfirming && this.pin.length > 0) {
      this.clearTransitionTimeout();
      const index = this.pin.length - 1;
      this.clearMaskTimeout(index);
      this.clearPulseTimeout(index);
      this.pin = this.pin.slice(0, -1);
      this.pinDisplay[index] = '';
      this.pinPulseStates[index] = false;
    } else if (this.isConfirming && this.confirmPin.length > 0) {
      this.clearTransitionTimeout();
      const index = this.confirmPin.length - 1;
      this.clearMaskTimeout(index, true);
      this.clearPulseTimeout(index, true);
      this.confirmPin = this.confirmPin.slice(0, -1);
      this.confirmPinDisplay[index] = '';
      this.confirmPinPulseStates[index] = false;
    }
  }

  reset(withFeedback = true): void {
    const hadInput = this.pin.length > 0 || this.confirmPin.length > 0;
    this.clearTransitionTimeout();
    this.clearAllSlotTimers();
    this.pin = '';
    this.confirmPin = '';
    this.pinDisplay = ['', '', '', '', '', ''];
    this.confirmPinDisplay = ['', '', '', '', '', ''];
    this.pinPulseStates = [false, false, false, false, false, false];
    this.confirmPinPulseStates = [false, false, false, false, false, false];
    this.isConfirming = false;
    if (withFeedback && hadInput) {
      void this.pinFeedback.notifyResetAction();
    }
  }

  cancel(): void {
    this.dialogClosed = true;
    this.clearTransitionTimeout();
    this.clearAllSlotTimers();
    this.dialogRef.close();
  }

  private pulseSlot(index: number, isConfirming = false): void {
    const pulseStates = isConfirming ? this.confirmPinPulseStates : this.pinPulseStates;
    const timeoutArray = isConfirming ? this.confirmPinPulseTimeouts : this.pinPulseTimeouts;
    this.clearPulseTimeout(index, isConfirming);
    pulseStates[index] = true;
    timeoutArray[index] = window.setTimeout(() => {
      pulseStates[index] = false;
      timeoutArray[index] = undefined;
    }, this.slotPulseDurationMs);
  }

  private clearAllSlotTimers(): void {
    for (let index = 0; index < this.pinLength; index += 1) {
      this.clearMaskTimeout(index);
      this.clearMaskTimeout(index, true);
      this.clearPulseTimeout(index);
      this.clearPulseTimeout(index, true);
    }
  }

  private clearMaskTimeout(index: number, isConfirming = false): void {
    const timeoutArray = isConfirming ? this.confirmPinMaskTimeouts : this.pinMaskTimeouts;
    const timeoutId = timeoutArray[index];
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId);
      timeoutArray[index] = undefined;
    }
  }

  private clearPulseTimeout(index: number, isConfirming = false): void {
    const timeoutArray = isConfirming ? this.confirmPinPulseTimeouts : this.pinPulseTimeouts;
    const timeoutId = timeoutArray[index];
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId);
      timeoutArray[index] = undefined;
    }
  }

  private clearTransitionTimeout(): void {
    if (this.transitionTimeoutId !== undefined) {
      window.clearTimeout(this.transitionTimeoutId);
      this.transitionTimeoutId = undefined;
    }
  }

  private showPinMismatchMessage(): void {
    this.dialog.open(DisplayMessage, {
      panelClass: '',
      closeOnNavigation: false,
      data: {
        showAlways: true,
        title: this.translation.t('common.pin.title'),
        image: '',
        icon: 'warning',
        message: this.translation.t('common.pin.mismatch'),
        button: this.translation.t('common.actions.ok'),
        delay: 0,
        showSpinner: false,
        autoclose: false
      },
      maxWidth: '90vw',
      maxHeight: '90vh',
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
      autoFocus: false
    });
  }
}
