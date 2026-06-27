import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatIcon } from "@angular/material/icon";
import { TranslocoPipe } from '@jsverse/transloco';
import { DialogHeaderComponent } from '../../utils/dialog-header/dialog-header.component';

@Component({
  selector: 'app-deletemessage',
  imports: [
    DialogHeaderComponent,MatButtonModule, MatDialogActions, MatDialogClose, MatDialogContent, TranslocoPipe, MatIcon],
  templateUrl: './delete-message.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './delete-message.component.css'
})
export class DeleteMessageComponent {
  readonly dialogRef = inject(MatDialogRef<DeleteMessageComponent>);
  readonly data = inject<{ titleKey?: string; confirmKey?: string } | null>(MAT_DIALOG_DATA, { optional: true });
  readonly titleKey = this.data?.titleKey ?? 'common.messageList.deleteDialog.title';
  readonly confirmKey = this.data?.confirmKey ?? 'common.messageList.deleteDialog.confirm';
}
