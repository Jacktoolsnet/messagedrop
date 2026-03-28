import { Injectable, inject } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Observable, filter, map, shareReplay } from 'rxjs';
import { DisplayMessageComponent } from '../components/shared/display-message/display-message.component';
import { DisplayMessageConfig } from '../interfaces/display-message-config.interface';

type SnackbarHorizontalPosition = 'start' | 'center' | 'end' | 'left' | 'right';
type SnackbarVerticalPosition = 'top' | 'bottom';
type DisplayMessageCloseResult = boolean | 'secondary' | undefined;

export interface DisplayMessageOpenConfig {
  duration?: number;
  horizontalPosition?: SnackbarHorizontalPosition;
  verticalPosition?: SnackbarVerticalPosition;
  panelClass?: string | string[];
}

export class DisplayMessageRef {
  private readonly afterClosed$: Observable<DisplayMessageCloseResult>;

  constructor(
    private readonly dialogRef: MatDialogRef<DisplayMessageComponent, DisplayMessageCloseResult>,
    private readonly hasAction: boolean
  ) {
    this.afterClosed$ = this.dialogRef.afterClosed().pipe(
      shareReplay({ bufferSize: 1, refCount: false })
    );
  }

  onAction(): Observable<void> {
    return this.afterClosed$.pipe(
      filter((result): result is true => this.hasAction && result === true),
      map(() => void 0)
    );
  }

  afterClosed(): Observable<DisplayMessageCloseResult> {
    return this.afterClosed$;
  }

  dismiss(): void {
    this.dialogRef.close();
  }
}

@Injectable({
  providedIn: 'root'
})
export class DisplayMessageService {
  private readonly dialog = inject(MatDialog);
  private activeToastRef: MatDialogRef<DisplayMessageComponent, DisplayMessageCloseResult> | null = null;

  open(message: string, action?: string, config: DisplayMessageOpenConfig = {}): DisplayMessageRef {
    this.activeToastRef?.close();

    const toneClass = this.resolveToneClass(config.panelClass);
    const toastRef = this.dialog.open(DisplayMessageComponent, {
      data: this.buildDialogData(message, action, toneClass, config.duration),
      autoFocus: false,
      restoreFocus: false,
      hasBackdrop: false,
      panelClass: ['display-message-toast', toneClass],
      position: this.resolvePosition(config),
      maxWidth: 'min(420px, calc(100vw - 32px))'
    });

    this.activeToastRef = toastRef;
    toastRef.afterClosed().subscribe(() => {
      if (this.activeToastRef === toastRef) {
        this.activeToastRef = null;
      }
    });

    return new DisplayMessageRef(toastRef, !!action);
  }

  private buildDialogData(
    message: string,
    action: string | undefined,
    toneClass: string,
    duration?: number
  ): DisplayMessageConfig {
    return {
      showAlways: true,
      title: '',
      image: '',
      icon: this.resolveIcon(toneClass),
      message,
      button: action ?? '',
      delay: Math.max(0, duration ?? 3000),
      showSpinner: false,
      autoclose: (duration ?? 3000) > 0,
      layout: 'toast'
    };
  }

  private resolveToneClass(panelClass?: string | string[]): string {
    const classes = Array.isArray(panelClass) ? panelClass : panelClass ? [panelClass] : [];

    if (classes.includes('snack-error')) {
      return 'toast-error';
    }

    if (classes.includes('snack-warning')) {
      return 'toast-warning';
    }

    if (classes.includes('snack-success')) {
      return 'toast-success';
    }

    return 'toast-info';
  }

  private resolveIcon(toneClass: string): string {
    switch (toneClass) {
      case 'toast-error':
        return 'error_outline';
      case 'toast-warning':
        return 'warning_amber';
      case 'toast-success':
        return 'task_alt';
      default:
        return 'info';
    }
  }

  private resolvePosition(config: DisplayMessageOpenConfig): { top?: string; bottom?: string; left?: string; right?: string } {
    const position: { top?: string; bottom?: string; left?: string; right?: string } = {};
    const horizontal = config.horizontalPosition ?? 'center';
    const vertical = config.verticalPosition ?? 'bottom';

    if (vertical === 'top') {
      position.top = '16px';
    } else {
      position.bottom = '16px';
    }

    if (horizontal === 'left' || horizontal === 'start') {
      position.left = '16px';
    } else if (horizontal === 'right' || horizontal === 'end') {
      position.right = '16px';
    }

    return position;
  }
}
