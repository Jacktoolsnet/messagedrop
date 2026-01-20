import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';

import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { A11yModule } from '@angular/cdk/a11y';
import { MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogContent, MatDialogModule, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { TileQuickAction, TileSetting } from '../../../../interfaces/tile-settings';
import { TranslocoPipe } from '@jsverse/transloco';
import { TranslationHelperService } from '../../../../services/translation-helper.service';
import { MaticonPickerComponent } from '../../../utils/maticon-picker/maticon-picker.component';
import { QuickActionActionEditComponent } from '../quick-action-action-edit/quick-action-action-edit.component';

interface QuickActionTileDialogData {
  tile: TileSetting;
}

@Component({
  selector: 'app-quick-action-tile-edit',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIcon,
    A11yModule,
    CdkDrag,
    CdkDropList,
    CdkDragHandle,
    TranslocoPipe
  ],
  templateUrl: './quick-action-tile-edit.component.html',
  styleUrl: './quick-action-tile-edit.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class QuickActionTileEditComponent {
  private readonly dialogRef = inject(MatDialogRef<QuickActionTileEditComponent>);
  private readonly dialog = inject(MatDialog);
  private readonly translation = inject(TranslationHelperService);
  readonly data = inject<QuickActionTileDialogData>(MAT_DIALOG_DATA);
  private readonly allowedActionTypes: TileQuickAction['type'][] = ['web', 'email', 'phone', 'whatsapp', 'sms'];

  readonly titleControl = new FormControl(
    this.data.tile.payload?.title ?? this.data.tile.label ?? this.translation.t('common.tileTypes.quickActions'),
    { nonNullable: true }
  );
  readonly icon = signal<string | undefined>(this.data.tile.payload?.icon ?? 'bolt');
  readonly actions = signal<TileQuickAction[]>(this.normalizeActions(this.data.tile.payload?.actions));

  get hasActions(): boolean {
    return this.actions().length > 0;
  }

  pickIcon(): void {
    const ref = this.dialog.open(MaticonPickerComponent, {
      width: '520px',
      data: { current: this.icon() },
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop-transparent',
      disableClose: true,
    });

    ref.afterClosed().subscribe((selected?: string | null) => {
      if (selected !== undefined) {
        this.icon.set(selected || undefined);
      }
    });
  }

  addAction(): void {
    const action: TileQuickAction = {
      id: this.createActionId(),
      label: this.translation.t('common.tiles.quickActions.actionFallback'),
      type: 'web',
      value: '',
      icon: 'public',
      order: this.actions().length
    };
    this.openActionEditor(action, true);
  }

  editAction(action: TileQuickAction): void {
    this.openActionEditor({ ...action }, false);
  }

  deleteAction(action: TileQuickAction): void {
    this.actions.set(this.actions().filter(item => item.id !== action.id));
  }

  drop(event: CdkDragDrop<TileQuickAction[]>) {
    const updated = [...this.actions()];
    moveItemInArray(updated, event.previousIndex, event.currentIndex);
    this.actions.set(updated.map((action, index) => ({ ...action, order: index })));
  }

  cancel(): void {
    this.dialogRef.close();
  }

  save(): void {
    const title = this.titleControl.value.trim() || this.translation.t('common.tileTypes.quickActions');
    const actions = this.normalizeActions(this.actions());
    const updated: TileSetting = {
      ...this.data.tile,
      label: title,
      payload: {
        ...this.data.tile.payload,
        title,
        icon: this.icon(),
        actions
      }
    };
    this.dialogRef.close(updated);
  }

  getActionLabel(action: TileQuickAction): string {
    const fallback = this.translation.t('common.tiles.quickActions.actionFallback');
    return action.label?.trim() || action.value || fallback;
  }

  getActionIcon(action: TileQuickAction): string {
    return action.icon || this.defaultIconForType(action.type);
  }

  getActionMeta(action: TileQuickAction): string {
    const typeLabel = this.translation.t(`common.tileLinkTypes.${action.type}`);
    if (!action.value) return typeLabel;
    return `${typeLabel} · ${action.value}`;
  }

  private openActionEditor(action: TileQuickAction, isNew: boolean): void {
    const ref = this.dialog.open(QuickActionActionEditComponent, {
      width: '520px',
      maxWidth: '95vw',
      data: { action },
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop-transparent',
      disableClose: true,
    });

    ref.afterClosed().subscribe((updated?: TileQuickAction) => {
      if (!updated) return;
      if (isNew) {
        const updatedList = [...this.actions(), updated];
        this.actions.set(this.normalizeActions(updatedList));
      } else {
        const updatedList = this.actions().map(item => item.id === updated.id ? updated : item);
        this.actions.set(this.normalizeActions(updatedList));
      }
    });
  }

  private normalizeActions(actions?: TileQuickAction[]): TileQuickAction[] {
    const fallbackLabel = this.translation.t('common.tiles.quickActions.actionFallback');
    return (actions ?? [])
      .map((action, index) => ({
        ...action,
        type: this.allowedActionTypes.includes(action.type ?? 'web') ? (action.type ?? 'web') : 'web',
        label: action.label?.trim() || fallbackLabel,
        value: action.value?.trim() || '',
        order: Number.isFinite(action.order) ? action.order : index
      }))
      .filter(action => action.value !== '')
      .sort((a, b) => a.order - b.order)
      .map((action, index) => ({ ...action, order: index }));
  }

  private createActionId(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return `action-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  private defaultIconForType(type: TileQuickAction['type']): string {
    switch (type) {
      case 'phone':
        return 'call';
      case 'email':
        return 'mail';
      case 'whatsapp':
        return 'chat';
      case 'sms':
        return 'sms';
      case 'web':
      default:
        return 'public';
    }
  }
}
