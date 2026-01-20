import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { Contact } from '../../../interfaces/contact';
import { TranslationHelperService } from '../../../services/translation-helper.service';

interface ContactSortDialogData {
  contacts: Contact[];
}

interface ContactSortDialogResult {
  orderedIds: string[];
}

@Component({
  selector: 'app-contact-sort-dialog',
  imports: [
    CommonModule,
    MatButtonModule,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatIcon,
    CdkDropList,
    CdkDrag,
    CdkDragHandle,
    TranslocoPipe
  ],
  templateUrl: './contact-sort-dialog.component.html',
  styleUrl: './contact-sort-dialog.component.css'
})
export class ContactSortDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<ContactSortDialogComponent>);
  private readonly translation = inject(TranslationHelperService);
  private readonly data = inject<ContactSortDialogData>(MAT_DIALOG_DATA);
  readonly contacts = signal<Contact[]>(this.data.contacts.map(contact => ({ ...contact })));

  drop(event: CdkDragDrop<Contact[]>) {
    const updated = [...this.contacts()];
    moveItemInArray(updated, event.previousIndex, event.currentIndex);
    this.contacts.set(updated);
  }

  getContactName(contact: Contact): string {
    return contact.name?.trim() || this.translation.t('common.contact.list.nameFallback');
  }

  close(): void {
    this.dialogRef.close();
  }

  apply(): void {
    const orderedIds = this.contacts().map(contact => contact.id);
    this.dialogRef.close({ orderedIds } as ContactSortDialogResult);
  }
}
