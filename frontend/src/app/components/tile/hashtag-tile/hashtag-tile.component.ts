import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { Contact } from '../../../interfaces/contact';
import { Place } from '../../../interfaces/place';
import { ContactService } from '../../../services/contact.service';
import { PlaceService } from '../../../services/place.service';
import { HashtagEditDialogComponent, HashtagEditDialogResult } from '../../utils/hashtag-edit-dialog/hashtag-edit-dialog.component';

@Component({
  selector: 'app-hashtag-tile',
  imports: [
    MatIcon,
    MatButtonModule,
    TranslocoPipe
  ],
  templateUrl: './hashtag-tile.component.html',
  styleUrl: './hashtag-tile.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HashtagTileComponent {
  @Input() place?: Place;
  @Input() contact?: Contact;

  private readonly dialog = inject(MatDialog);
  private readonly placeService = inject(PlaceService);
  private readonly contactService = inject(ContactService);
  private readonly cdr = inject(ChangeDetectorRef);

  get hashtags(): string[] {
    return [...(this.place?.hashtags ?? this.contact?.hashtags ?? [])];
  }

  editHashtags(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();

    const dialogRef = this.dialog.open(HashtagEditDialogComponent, {
      width: 'min(680px, 96vw)',
      maxWidth: '96vw',
      height: 'auto',
      maxHeight: '95vh',
      data: {
        titleKey: this.contact ? 'common.hashtags.editContactTitle' : 'common.hashtags.editPlaceTitle',
        mode: 'local',
        initialTags: this.hashtags,
        helpKey: 'hashtagSearch'
      },
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
      autoFocus: false
    });

    dialogRef.afterClosed().subscribe((result?: HashtagEditDialogResult) => {
      if (!result) {
        return;
      }
      this.applyHashtags(result.hashtags);
    });
  }

  removeHashtag(tag: string, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    const tags = this.hashtags.filter(existing => existing !== tag);
    this.applyHashtags(tags);
  }

  private applyHashtags(tags: string[]): void {
    if (this.place) {
      this.place.hashtags = [...tags];
      void this.placeService.saveAdditionalPlaceInfos(this.place);
    }

    if (this.contact) {
      this.contact.hashtags = [...tags];
      void this.contactService.saveAditionalContactInfos();
      this.contactService.refreshContact(this.contact.id);
    }

    this.cdr.markForCheck();
  }
}
