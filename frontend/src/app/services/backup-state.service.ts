import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class BackupStateService {
  private readonly dirtySignal = signal(false);
  readonly dirty = this.dirtySignal.asReadonly();

  markDirty(): void {
    this.dirtySignal.set(true);
  }

  clearDirty(): void {
    this.dirtySignal.set(false);
  }

  isDirty(): boolean {
    return this.dirtySignal();
  }
}
