import { CommonModule } from '@angular/common';
import { Component, HostListener, OnDestroy, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { TranslocoPipe } from '@jsverse/transloco';
import { PinInputFeedbackService } from '../../../services/pin-input-feedback.service';

interface CheckPinDialogData {
  enterHintI18nKey?: string;
}

@Component({
  selector: 'app-check-pin',
  imports: [
    CommonModule,
    MatIcon,
    MatInputModule,
    MatButtonModule,
    TranslocoPipe
  ],
  templateUrl: './check-pin.component.html',
  styleUrl: './check-pin.component.css'
})

export class CheckPinComponent implements OnDestroy {
  pin = '';
  pinLength = 6;
  pinDisplay: string[] = ['', '', '', '', '', ''];
  pinPulseStates: boolean[] = [false, false, false, false, false, false];
  readonly digitVisibilityDurationMs = 550;
  readonly slotPulseDurationMs = 240;
  private readonly pinMaskTimeouts: Array<number | undefined> = new Array<number | undefined>(this.pinLength).fill(undefined);
  private readonly pinPulseTimeouts: Array<number | undefined> = new Array<number | undefined>(this.pinLength).fill(undefined);
  private confirmTimeoutId?: number;

  private readonly dialogData = inject<CheckPinDialogData | null>(MAT_DIALOG_DATA, { optional: true });
  private readonly dialogRef = inject(MatDialogRef<CheckPinComponent>);
  private readonly pinFeedback = inject(PinInputFeedbackService);

  get enterHintI18nKey(): string {
    return this.dialogData?.enterHintI18nKey ?? 'common.pin.enterHint';
  }

  ngOnDestroy(): void {
    this.clearConfirmTimeout();
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
    return this.pin.length;
  }

  addDigit(digit: string): void {
    if (this.pin.length < this.pinLength) {
      const index = this.pin.length;
      this.pin += digit;
      this.showDigitTemporarily(index);
      this.pulseSlot(index);
      void this.pinFeedback.notifyAcceptedInput();

      if (this.pin.length === this.pinLength) {
        this.clearConfirmTimeout();
        this.confirmTimeoutId = window.setTimeout(() => {
          this.confirm();
        }, this.digitVisibilityDurationMs);
      }
    }
  }

  showDigitTemporarily(index: number): void {
    this.clearPinMaskTimeout(index);
    const displayArray = this.pinDisplay;
    const pin = this.pin;
    displayArray[index] = pin[index];
    this.pinMaskTimeouts[index] = window.setTimeout(() => {
      if (this.pin.length > index) {
        displayArray[index] = '•';
      }
      this.pinMaskTimeouts[index] = undefined;
    }, this.digitVisibilityDurationMs);
  }

  reset(): void {
    const hadInput = this.pin.length > 0;
    this.clearConfirmTimeout();
    this.clearAllSlotTimers();
    this.pin = '';
    this.pinDisplay = ['', '', '', '', '', ''];
    this.pinPulseStates = [false, false, false, false, false, false];
    if (hadInput) {
      void this.pinFeedback.notifyResetAction();
    }
  }

  confirm(): void {
    if (this.pin.length === this.pinLength) {
      this.dialogRef.close(this.pin);
    }
  }

  removeDigit(): void {
    if (this.pin.length > 0) {
      this.clearConfirmTimeout();
      const index = this.pin.length - 1;
      this.clearPinMaskTimeout(index);
      this.clearPinPulseTimeout(index);
      this.pin = this.pin.slice(0, -1);
      this.pinDisplay[index] = '';
      this.pinPulseStates[index] = false;
    }
  }

  cancel(): void {
    this.clearConfirmTimeout();
    this.clearAllSlotTimers();
    this.dialogRef.close();
  }

  private pulseSlot(index: number): void {
    this.clearPinPulseTimeout(index);
    this.pinPulseStates[index] = true;
    this.pinPulseTimeouts[index] = window.setTimeout(() => {
      this.pinPulseStates[index] = false;
      this.pinPulseTimeouts[index] = undefined;
    }, this.slotPulseDurationMs);
  }

  private clearAllSlotTimers(): void {
    for (let index = 0; index < this.pinLength; index += 1) {
      this.clearPinMaskTimeout(index);
      this.clearPinPulseTimeout(index);
    }
  }

  private clearPinMaskTimeout(index: number): void {
    const timeoutId = this.pinMaskTimeouts[index];
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId);
      this.pinMaskTimeouts[index] = undefined;
    }
  }

  private clearPinPulseTimeout(index: number): void {
    const timeoutId = this.pinPulseTimeouts[index];
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId);
      this.pinPulseTimeouts[index] = undefined;
    }
  }

  private clearConfirmTimeout(): void {
    if (this.confirmTimeoutId !== undefined) {
      window.clearTimeout(this.confirmTimeoutId);
      this.confirmTimeoutId = undefined;
    }
  }
}
