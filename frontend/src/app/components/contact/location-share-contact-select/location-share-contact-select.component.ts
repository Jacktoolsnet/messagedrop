import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialogActions, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { Contact } from '../../../interfaces/contact';
import { ContactService } from '../../../services/contact.service';
import { DialogHeaderComponent } from '../../utils/dialog-header/dialog-header.component';
import { HelpDialogService } from '../../utils/help-dialog/help-dialog.service';

@Component({
  selector: 'app-location-share-contact-select',
  imports: [
    DialogHeaderComponent,
    MatButtonModule,
    MatCheckboxModule,
    MatDialogActions,
    MatDialogContent,
    MatIconModule,
    TranslocoPipe
  ],
  templateUrl: './location-share-contact-select.component.html',
  styleUrl: './location-share-contact-select.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LocationShareContactSelectComponent {
  private readonly contactService = inject(ContactService);
  private readonly dialogRef = inject(MatDialogRef<LocationShareContactSelectComponent, Contact[]>);
  readonly help = inject(HelpDialogService);

  readonly contacts = computed(() =>
    this.contactService.sortedContactsSignal().filter((contact) => (contact.status || 'active') === 'active')
  );
  readonly selectedIds = signal<Set<string>>(new Set<string>());
  readonly selectedCount = computed(() => this.selectedIds().size);

  isSelected(contact: Contact): boolean {
    return this.selectedIds().has(contact.id);
  }

  toggle(contact: Contact): void {
    this.selectedIds.update((current) => {
      const next = new Set(current);
      if (next.has(contact.id)) {
        next.delete(contact.id);
      } else {
        next.add(contact.id);
      }
      return next;
    });
  }

  getContactDisplayName(contact: Contact): string {
    return contact.name?.trim() || contact.hint?.trim() || contact.contactUserId || contact.id;
  }

  cancel(): void {
    this.dialogRef.close();
  }

  share(): void {
    const selectedIds = this.selectedIds();
    const selectedContacts = this.contacts().filter((contact) => selectedIds.has(contact.id));
    this.dialogRef.close(selectedContacts);
  }
}
