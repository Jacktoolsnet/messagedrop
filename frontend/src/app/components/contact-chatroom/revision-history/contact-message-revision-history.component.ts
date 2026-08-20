import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { ShortMessage } from '../../../interfaces/short-message';
import { LocationPreviewComponent } from '../../utils/location-preview/location-preview.component';
import { DialogHeaderComponent } from '../../utils/dialog-header/dialog-header.component';
import { ShowmessageComponent } from '../../showmessage/showmessage.component';
import { ShowmultimediaComponent } from '../../multimedia/showmultimedia/showmultimedia.component';

export interface ContactMessageRevisionHistoryEntry {
  messageId: string;
  createdAt: string;
  payload: ShortMessage | null;
  displayText: string;
}

interface ContactMessageRevisionHistoryData {
  revisions: ContactMessageRevisionHistoryEntry[];
}

@Component({
  selector: 'app-contact-message-revision-history',
  imports: [
    CommonModule,
    DialogHeaderComponent,
    LocationPreviewComponent,
    MatButtonModule,
    MatDialogActions,
    MatDialogContent,
    MatIcon,
    ShowmessageComponent,
    ShowmultimediaComponent,
    TranslocoPipe
  ],
  templateUrl: './contact-message-revision-history.component.html',
  styleUrl: './contact-message-revision-history.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ContactMessageRevisionHistoryComponent {
  readonly data = inject<ContactMessageRevisionHistoryData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<ContactMessageRevisionHistoryComponent>);

  close(): void {
    this.dialogRef.close();
  }
}
