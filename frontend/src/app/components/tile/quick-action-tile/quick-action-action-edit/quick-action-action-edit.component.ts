import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';

import { A11yModule } from '@angular/cdk/a11y';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogContent, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { TranslocoPipe } from '@jsverse/transloco';
import { TileLinkType, TileQuickAction } from '../../../../interfaces/tile-settings';
import { TranslationHelperService } from '../../../../services/translation-helper.service';
import { HelpDialogService } from '../../../utils/help-dialog/help-dialog.service';
import { DialogHeaderComponent } from '../../../utils/dialog-header/dialog-header.component';
import {
  TileDisplaySettingsDialogComponent,
  TileDisplaySettingsDialogData,
  TileDisplaySettingsDialogResult
} from '../../tile-display-settings-dialog/tile-display-settings-dialog.component';

interface QuickActionDialogData {
  action: TileQuickAction;
}

@Component({
  selector: 'app-quick-action-action-edit',
  standalone: true,
  imports: [
    DialogHeaderComponent,
    ReactiveFormsModule,
    MatDialogModule,
    MatDialogContent,
    MatDialogActions,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIcon,
    A11yModule,
    TranslocoPipe
  ],
  templateUrl: './quick-action-action-edit.component.html',
  styleUrl: './quick-action-action-edit.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class QuickActionActionEditComponent {
  private readonly dialogRef = inject(MatDialogRef<QuickActionActionEditComponent>);
  private readonly dialog = inject(MatDialog);
  private readonly translation = inject(TranslationHelperService);
  readonly help = inject(HelpDialogService);
  readonly data = inject<QuickActionDialogData>(MAT_DIALOG_DATA);
  private readonly fallbackLabel = this.translation.t('common.tiles.quickActions.actionFallback');
  private iconAuto = true;
  private lastType: TileLinkType;

  readonly actionTypes: { value: TileLinkType; labelKey: string }[] = [
    { value: 'web', labelKey: 'common.tileLinkTypes.web' },
    { value: 'email', labelKey: 'common.tileLinkTypes.email' },
    { value: 'phone', labelKey: 'common.tileLinkTypes.phone' },
    { value: 'whatsapp', labelKey: 'common.tileLinkTypes.whatsapp' },
    { value: 'sms', labelKey: 'common.tileLinkTypes.sms' }
  ];

  readonly labelControl = new FormControl(
    this.data.action.label ?? this.fallbackLabel,
    { nonNullable: true }
  );
  readonly valueControl = new FormControl(this.data.action.value ?? '', { nonNullable: true });
  readonly typeControl = new FormControl<TileLinkType>(this.normalizeType(this.data.action.type), { nonNullable: true });
  readonly icon = signal<string | undefined>(this.data.action.icon ?? this.defaultIconForType(this.data.action.type));

  get headerTitle(): string {
    return this.labelControl.value.trim() || this.fallbackLabel;
  }

  get headerIcon(): string {
    return this.icon() || this.defaultIconForType(this.typeControl.value);
  }

  constructor() {
    this.iconAuto = this.isDefaultIcon(this.icon(), this.typeControl.value);
    this.lastType = this.typeControl.value;
    this.applyValidators(this.typeControl.value);
    this.typeControl.valueChanges.subscribe(type => {
      this.applyValidators(type);
      if (this.iconAuto && this.isDefaultIcon(this.icon(), this.lastType)) {
        this.icon.set(this.defaultIconForType(type));
      }
      this.lastType = type;
    });
  }

  openDisplaySettings(): void {
    const ref = this.dialog.open<TileDisplaySettingsDialogComponent, TileDisplaySettingsDialogData, TileDisplaySettingsDialogResult | undefined>(
      TileDisplaySettingsDialogComponent,
      {
        width: '460px',
        maxWidth: '95vw',
        data: {
          title: this.headerTitle,
          icon: this.icon(),
          fallbackTitle: this.fallbackLabel,
          dialogTitleKey: 'common.tileEdit.displaySettingsTitle'
        },
        hasBackdrop: true,
        backdropClass: 'dialog-backdrop',
        disableClose: false,
      }
    );

    ref.afterClosed().subscribe((result) => {
      if (!result) {
        return;
      }
      this.labelControl.setValue(result.title);
      this.icon.set(result.icon);
      this.iconAuto = !result.icon || result.icon === this.defaultIconForType(this.typeControl.value);
    });
  }

  cancel(): void {
    this.dialogRef.close();
  }

  save(): void {
    if (this.valueControl.invalid) {
      this.valueControl.markAsTouched();
      return;
    }

    const label = this.labelControl.value.trim() || this.fallbackLabel;
    const value = this.valueControl.value.trim();
    const type = this.typeControl.value;

    const updated: TileQuickAction = {
      ...this.data.action,
      label,
      value,
      type,
      icon: this.icon()
    };

    this.dialogRef.close(updated);
  }

  private normalizeType(type: TileLinkType | undefined): TileLinkType {
    const allowed: TileLinkType[] = ['web', 'email', 'phone', 'whatsapp', 'sms'];
    return allowed.includes(type ?? 'web') ? (type as TileLinkType) : 'web';
  }

  private applyValidators(type: TileLinkType) {
    const validators = [Validators.required];
    if (type === 'web') {
      validators.push(Validators.pattern(/^(https?:\/\/)?([a-zA-Z0-9-]+\.)+[A-Za-z]{2,}.*$/));
    }
    if (type === 'phone' || type === 'whatsapp' || type === 'sms') {
      validators.push(Validators.pattern(/^[0-9+][0-9 ()-]{3,}$/));
    }
    if (type === 'email') {
      validators.push(Validators.email);
    }
    this.valueControl.setValidators(validators);
    this.valueControl.updateValueAndValidity({ emitEvent: false });
  }

  private defaultIconForType(type: TileLinkType | undefined): string {
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

  private isDefaultIcon(icon: string | undefined, type: TileLinkType): boolean {
    if (!icon) return true;
    return icon === this.defaultIconForType(type);
  }
}
