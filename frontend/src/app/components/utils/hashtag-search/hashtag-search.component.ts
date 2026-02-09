import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { TranslocoPipe } from '@jsverse/transloco';
import { DialogHeaderComponent } from '../dialog-header/dialog-header.component';
import { HelpDialogService, HelpTopic } from '../help-dialog/help-dialog.service';
import { Contact } from '../../../interfaces/contact';
import { Message } from '../../../interfaces/message';
import { Place } from '../../../interfaces/place';
import { ExperienceBookmark } from '../../../interfaces/experience-bookmark';
import { ContactService } from '../../../services/contact.service';
import { ExperienceBookmarkService } from '../../../services/experience-bookmark.service';
import { MessageService } from '../../../services/message.service';
import { PlaceService } from '../../../services/place.service';
import { TranslationHelperService } from '../../../services/translation-helper.service';
import { normalizeHashtags, stringifyHashtags } from '../../../utils/hashtag.util';

type SearchScope = 'all' | 'local' | 'public';

export interface HashtagSearchDialogData {
  initialTag?: string;
  helpKey?: HelpTopic;
}

export interface HashtagSearchResult {
  type: 'message' | 'place' | 'contact' | 'experience';
  message?: Message;
  place?: Place;
  contact?: Contact;
  experience?: ExperienceBookmark;
}

@Component({
  selector: 'app-hashtag-search',
  standalone: true,
  imports: [
    DialogHeaderComponent,
    FormsModule,
    MatDialogContent,
    MatDialogActions,
    MatDialogClose,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    TranslocoPipe
  ],
  templateUrl: './hashtag-search.component.html',
  styleUrl: './hashtag-search.component.css'
})
export class HashtagSearchComponent {
  readonly data = inject<HashtagSearchDialogData | null>(MAT_DIALOG_DATA, { optional: true });
  private readonly dialogRef = inject(MatDialogRef<HashtagSearchComponent, HashtagSearchResult>);
  private readonly messageService = inject(MessageService);
  private readonly placeService = inject(PlaceService);
  private readonly contactService = inject(ContactService);
  private readonly bookmarkService = inject(ExperienceBookmarkService);
  private readonly i18n = inject(TranslationHelperService);
  readonly help = inject(HelpDialogService);
  readonly helpTopic: HelpTopic = this.data?.helpKey ?? 'hashtagSearch';

  query = (this.data?.initialTag ?? '').trim();
  scope = signal<SearchScope>('all');
  errorText = signal('');
  loadingPublic = signal(false);
  normalizedTag = signal('');
  hasSearched = signal(false);

  readonly publicResults = signal<Message[]>([]);
  readonly localPlaceResults = signal<Place[]>([]);
  readonly localContactResults = signal<Contact[]>([]);
  readonly localExperienceResults = signal<ExperienceBookmark[]>([]);

  readonly publicMessages = computed(() =>
    this.publicResults().filter((message) => message.typ === 'public')
  );
  readonly publicComments = computed(() =>
    this.publicResults().filter((message) => message.typ === 'comment')
  );

  readonly hasAnyResult = computed(() =>
    this.publicResults().length > 0
    || this.localPlaceResults().length > 0
    || this.localContactResults().length > 0
    || this.localExperienceResults().length > 0
  );

  constructor() {
    void this.bookmarkService.ensureLoaded();
    if (this.query) {
      this.search();
    }
  }

  search(): void {
    const parsed = normalizeHashtags([this.query], 1);
    if (parsed.invalidTokens.length > 0 || parsed.tags.length === 0 || parsed.overflow > 0) {
      this.errorText.set(this.i18n.t('common.hashtags.invalidSearch'));
      this.hasSearched.set(true);
      this.clearResults();
      return;
    }
    this.errorText.set('');
    const tag = parsed.tags[0];
    this.normalizedTag.set(tag);
    this.hasSearched.set(true);

    if (this.scope() === 'all' || this.scope() === 'local') {
      this.searchLocal(tag);
    } else {
      this.localPlaceResults.set([]);
      this.localContactResults.set([]);
      this.localExperienceResults.set([]);
    }

    if (this.scope() === 'all' || this.scope() === 'public') {
      this.searchPublic(tag);
    } else {
      this.publicResults.set([]);
    }
  }

  onScopeChange(scope: SearchScope): void {
    this.scope.set(scope);
    if (this.normalizedTag()) {
      this.search();
    }
  }

  selectMessage(message: Message): void {
    this.dialogRef.close({ type: 'message', message });
  }

  selectPlace(place: Place): void {
    this.dialogRef.close({ type: 'place', place });
  }

  selectContact(contact: Contact): void {
    this.dialogRef.close({ type: 'contact', contact });
  }

  selectExperience(experience: ExperienceBookmark): void {
    this.dialogRef.close({ type: 'experience', experience });
  }

  hashtagsLabel(tags: string[] | undefined): string {
    return stringifyHashtags(tags ?? []);
  }

  getPublicPreview(message: Message): string {
    const text = message.message || '';
    if (text.length <= 140) {
      return text;
    }
    return `${text.slice(0, 140)}…`;
  }

  private clearResults(): void {
    this.publicResults.set([]);
    this.localPlaceResults.set([]);
    this.localContactResults.set([]);
    this.localExperienceResults.set([]);
  }

  private searchLocal(tag: string): void {
    const places = this.placeService.sortedPlacesSignal().filter((place) => this.hasTag(place.hashtags, tag));
    const contacts = this.contactService.sortedContactsSignal().filter((contact) => this.hasTag(contact.hashtags, tag));
    const experiences = this.bookmarkService.bookmarksSignal().filter((bookmark) => this.hasTag(bookmark.hashtags, tag));
    this.localPlaceResults.set(places);
    this.localContactResults.set(contacts);
    this.localExperienceResults.set(experiences);
  }

  private searchPublic(tag: string): void {
    this.loadingPublic.set(true);
    this.messageService.searchByHashtag(tag, false).subscribe({
      next: (response) => {
        const mapped = this.messageService.mapRawMessages(response.rows ?? []);
        this.publicResults.set(
          mapped.filter((message) => this.hasTag(message.hashtags, tag))
        );
        this.loadingPublic.set(false);
      },
      error: () => {
        this.publicResults.set([]);
        this.loadingPublic.set(false);
        this.errorText.set(this.i18n.t('common.hashtagSearch.publicFailed'));
      }
    });
  }

  private hasTag(tags: string[] | undefined, tag: string): boolean {
    return Array.isArray(tags) && tags.some((item) => item === tag);
  }
}
