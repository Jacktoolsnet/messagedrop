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
  title?: string;
  icon?: string;
  showSpinner?: boolean;
  autoclose?: boolean;
  layout?: 'dialog' | 'toast';
  disableClose?: boolean;
  hasBackdrop?: boolean;
  maxWidth?: string;
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
  private activeMessageRef: MatDialogRef<DisplayMessageComponent, DisplayMessageCloseResult> | null = null;

  open(message: string, action?: string, config: DisplayMessageOpenConfig = {}): DisplayMessageRef {
    this.activeMessageRef?.close();

    const toneClass = this.resolveToneClass(config.panelClass);
    const normalizedAction = this.normalizeAction(action);
    const layout = config.layout ?? 'toast';
    const isToast = layout === 'toast';
    const toastRef = this.dialog.open(DisplayMessageComponent, {
      data: this.buildDialogData(message, normalizedAction, toneClass, config),
      autoFocus: false,
      restoreFocus: false,
      disableClose: config.disableClose ?? false,
      hasBackdrop: config.hasBackdrop ?? !isToast,
      panelClass: isToast ? ['display-message-toast', toneClass] : undefined,
      position: isToast ? this.resolvePosition(config) : undefined,
      maxWidth: config.maxWidth ?? (isToast ? 'min(420px, calc(100vw - 32px))' : '92vw')
    });

    this.activeMessageRef = toastRef;
    toastRef.afterClosed().subscribe(() => {
      if (this.activeMessageRef === toastRef) {
        this.activeMessageRef = null;
      }
    });

    return new DisplayMessageRef(toastRef, !!normalizedAction);
  }

  private buildDialogData(
    message: string,
    action: string | undefined,
    toneClass: string,
    config: DisplayMessageOpenConfig
  ): DisplayMessageConfig {
    const layout = config.layout ?? 'toast';
    const normalizedDelay = Math.max(0, config.duration ?? (layout === 'toast' ? 3000 : 0));

    return {
      showAlways: true,
      title: config.title ?? '',
      image: '',
      icon: config.icon ?? this.resolveIcon(toneClass),
      message,
      button: action ?? '',
      delay: normalizedDelay,
      showSpinner: config.showSpinner ?? false,
      autoclose: config.autoclose ?? (layout === 'toast' && normalizedDelay > 0),
      layout
    };
  }

  private normalizeAction(action?: string): string {
    const trimmed = action?.trim() ?? '';
    if (!trimmed) {
      return '';
    }

    const normalized = trimmed.replace(/[.!?]/g, '').trim().toUpperCase();
    if (normalized === 'OK' || normalized === 'OKAY' || normalized === 'CLOSE' || normalized === 'SCHLIESSEN') {
      return '';
    }

    return trimmed;
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
