import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { Contact } from '../../../interfaces/contact';
import { ContactService } from '../../../services/contact.service';
import { TranslationHelperService } from '../../../services/translation-helper.service';
import { ContactSettingsComponent } from '../../contact/contact-setting/contact-settings.component';
import { HelpDialogService } from '../../utils/help-dialog/help-dialog.service';

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
  private readonly dialog = inject(MatDialog);
  private readonly contactService = inject(ContactService);
  private readonly translation = inject(TranslationHelperService);
  readonly help = inject(HelpDialogService);
  private readonly data = inject<ContactSortDialogData>(MAT_DIALOG_DATA);
  readonly contacts = signal<Contact[]>([...this.data.contacts]);

  drop(event: CdkDragDrop<Contact[]>) {
    const updated = [...this.contacts()];
    moveItemInArray(updated, event.previousIndex, event.currentIndex);
    this.contacts.set(updated);
  }

  getContactName(contact: Contact): string {
    return contact.name?.trim() || this.translation.t('common.contact.list.nameFallback');
  }

  openContactSettings(contact: Contact): void {
    const dialogRef = this.dialog.open(ContactSettingsComponent, {
      data: { contact },
      closeOnNavigation: true,
      maxHeight: '90vh',
      maxWidth: '90vw',
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
      autoFocus: false
    });

    dialogRef.afterClosed().subscribe(() => {
      this.contactService.updateContactName(contact);
      this.contactService.saveAditionalContactInfos();
      this.contacts.set([...this.contacts()]);
    });
  }

  close(): void {
    this.dialogRef.close();
  }

  apply(): void {
    const orderedIds = this.contacts().map(contact => contact.id);
    this.dialogRef.close({ orderedIds } as ContactSortDialogResult);
  }
}
