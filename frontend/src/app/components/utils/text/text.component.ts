
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from "@angular/material/icon";
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { TranslocoPipe } from '@jsverse/transloco';
import { HelpDialogService } from '../help-dialog/help-dialog.service';

type TextDialogData = {
  text: string;
  titleKey?: string;
  titleIcon?: string;
};

@Component({
  selector: 'app-message',
  imports: [
    MatButtonModule,
    MatDialogActions,
    MatDialogContent,
    MatDialogTitle,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatMenuModule,
    MatIcon,
    TranslocoPipe
  ],
  templateUrl: './text.component.html',
  styleUrl: './text.component.css'
})
export class TextComponent {
  readonly dialogRef = inject(MatDialogRef<TextComponent>);
  readonly data = inject<TextDialogData>(MAT_DIALOG_DATA);
  readonly help = inject(HelpDialogService);
  readonly titleKey = this.data.titleKey ?? 'common.textDialog.editTitle';
  readonly titleIcon = this.data.titleIcon ?? 'edit';

  onApplyClick(): void {
    this.dialogRef.close(this.data);
  }

  onAbortClick(): void {
    this.dialogRef.close();
  }
}
