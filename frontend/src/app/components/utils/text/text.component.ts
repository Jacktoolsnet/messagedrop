
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from "@angular/material/icon";
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';

@Component({
  selector: 'app-message',
  imports: [
    MatButtonModule,
    MatDialogActions,
    MatDialogContent,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatMenuModule,
    MatIcon
  ],
  templateUrl: './text.component.html',
  styleUrl: './text.component.css'
})
export class TextComponent {
  readonly dialogRef = inject(MatDialogRef<TextComponent>);
  readonly data = inject<{ text: string }>(MAT_DIALOG_DATA);

  onApplyClick(): void {
    this.dialogRef.close(this.data);
  }
}
