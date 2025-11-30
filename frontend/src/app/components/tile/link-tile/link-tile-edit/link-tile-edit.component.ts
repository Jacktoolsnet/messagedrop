import { ChangeDetectionStrategy, Component, Inject, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogContent, MatDialogModule, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { A11yModule } from '@angular/cdk/a11y';
import { TileSetting } from '../../../../interfaces/tile-settings';
import { MaticonPickerComponent } from '../../../utils/maticon-picker/maticon-picker.component';
import { MatDialog } from '@angular/material/dialog';

type LinkType = NonNullable<TileSetting['payload']>['linkType'];

interface LinkTileDialogData {
  tile: TileSetting;
}

@Component({
  selector: 'app-link-tile-edit',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIcon,
    A11yModule
  ],
  templateUrl: './link-tile-edit.component.html',
  styleUrl: './link-tile-edit.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LinkTileEditComponent {
  private readonly dialogRef = inject(MatDialogRef<LinkTileEditComponent>);
  private readonly dialog = inject(MatDialog);
  readonly data = inject<LinkTileDialogData>(MAT_DIALOG_DATA);

  readonly linkTypes: { value: LinkType; label: string }[] = [
    { value: 'web', label: 'Web' },
    { value: 'email', label: 'Mail' },
    { value: 'phone', label: 'Phone' }
  ];

  readonly titleControl = new FormControl(this.data.tile.payload?.title ?? this.data.tile.label ?? 'Link', { nonNullable: true });
  readonly urlControl = new FormControl(this.data.tile.payload?.url ?? '', { nonNullable: true });
  readonly linkTypeControl = new FormControl<LinkType>(this.normalizeLinkType(this.data.tile.payload?.linkType), { nonNullable: true });
  readonly icon = signal<string | undefined>(this.data.tile.payload?.icon ?? 'link');

  constructor() {
    this.applyValidators(this.linkTypeControl.value);
    this.linkTypeControl.valueChanges.subscribe(type => this.applyValidators(type));
  }

  private normalizeLinkType(type: LinkType | undefined): LinkType {
    const allowed: LinkType[] = ['web', 'email', 'phone'];
    return allowed.includes(type ?? 'web') ? (type as LinkType) : 'web';
  }

  private applyValidators(type: LinkType) {
    const validators = [Validators.required];
    if (type === 'web') {
      validators.push(Validators.pattern(/^(https?:\/\/)?([a-zA-Z0-9-]+\.)+[A-Za-z]{2,}.*$/));
    }
    if (type === 'phone') {
      validators.push(Validators.pattern(/^[0-9+][0-9 ()-]{3,}$/));
    }
    if (type === 'email') {
      validators.push(Validators.email);
    }
    this.urlControl.setValidators(validators);
    this.urlControl.updateValueAndValidity({ emitEvent: false });
  }

  pickIcon(): void {
    const ref = this.dialog.open(MaticonPickerComponent, {
      width: '520px',
      data: { current: this.icon() }
    });

    ref.afterClosed().subscribe((selected?: string | null) => {
      if (selected !== undefined) {
        this.icon.set(selected || undefined);
      }
    });
  }

  async pasteFromClipboard(): Promise<void> {
    try {
      if (!navigator?.clipboard?.readText) {
        return;
      }
      const text = (await navigator.clipboard.readText()).trim();
      if (text) {
        this.urlControl.setValue(text);
        this.urlControl.markAsTouched();
      }
    } catch {
      // Ignore clipboard errors silently.
    }
  }

  cancel(): void {
    this.dialogRef.close();
  }

  save(): void {
    if (this.urlControl.invalid) {
      this.urlControl.markAsTouched();
      return;
    }

    const title = this.titleControl.value.trim() || 'Link';
    const url = this.urlControl.value.trim();
    const linkType = this.linkTypeControl.value;
    const updated: TileSetting = {
      ...this.data.tile,
      label: title,
      payload: {
        ...this.data.tile.payload,
        title,
        url,
        linkType,
        icon: this.icon()
      }
    };
    this.dialogRef.close(updated);
  }
}
