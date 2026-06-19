
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatRadioModule } from '@angular/material/radio';
import { TranslocoPipe } from '@jsverse/transloco';
import { AppSettings } from '../../../interfaces/app-settings';
import { Multimedia } from '../../../interfaces/multimedia';
import { MultimediaType } from '../../../interfaces/multimedia-type';
import { GifApiResponse, GifResult } from '../../../interfaces/gif-response';
import { AppService } from '../../../services/app.service';
import { GifService, KlipyMediaKind } from '../../../services/gif.service';
import { TranslationHelperService } from '../../../services/translation-helper.service';
import { EnableExternalContentComponent } from "../enable-external-content/enable-external-content.component";
import { HelpDialogService } from '../help-dialog/help-dialog.service';

@Component({
  selector: 'app-multimedia',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogActions,
    MatDialogClose,
    MatDialogContent,
    MatIcon,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatMenuModule,
    MatRadioModule,
    TranslocoPipe,
    EnableExternalContentComponent
  ],
  templateUrl: './gif-search.component.html',
  styleUrl: './gif-search.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GifSearchComponent implements OnInit {
  @ViewChild('searchInput') private searchInput?: ElementRef<HTMLInputElement>;

  readonly searchControl = new FormControl('', { nonNullable: true });
  lastSearchTerm = '';
  nextFeatured = '';
  nextSearch = '';
  readonly mediaKinds: KlipyMediaKind[] = ['gif', 'sticker', 'clip', 'meme'];
  selectedKind: KlipyMediaKind = 'gif';
  results: GifResult[] = [];
  showGifProvider = false;

  private readonly appService = inject(AppService);
  private readonly dialogRef = inject(MatDialogRef<GifSearchComponent>);
  private readonly gifService = inject(GifService);
  private readonly translation = inject(TranslationHelperService);
  private readonly cdRef = inject(ChangeDetectorRef);
  readonly help = inject(HelpDialogService);

  ngOnInit(): void {
    this.showGifProvider = this.appService.getAppSettings().enableKlipyContent;
    if (this.showGifProvider) {
      this.getFeaturedGifs();
    } else {
      this.results = [];
    }
  }

  getFeaturedGifs(): void {
    this.gifService.getFeaturedGifs(this.nextFeatured, true, this.selectedKind).subscribe({
      next: (gifResponse: GifApiResponse) => this.updateResults(gifResponse, 'featured'),
      error: (error) => this.handleGifError(error)
    });
  }

  searchGifs(): void {
    const term = this.searchControl.value.trim();
    if (!term) {
      this.getFeaturedGifs();
      return;
    }

    this.gifService.searchGifs(term, this.nextSearch, true, this.selectedKind).subscribe({
      next: (gifResponse: GifApiResponse) => this.updateResults(gifResponse, 'search'),
      error: (error) => this.handleGifError(error)
    });
  }

  search(): void {
    this.searchInput?.nativeElement.blur();
    const currentTerm = this.searchControl.value.trim();
    if (!currentTerm) {
      this.getFeaturedGifs();
    } else {
      if (currentTerm !== this.lastSearchTerm) {
        this.lastSearchTerm = currentTerm;
        this.nextSearch = '';
      }
      this.searchGifs();
    }
  }

  onApplyClick(result: GifResult): void {
    const multimedia: Multimedia = {
      type: MultimediaType.KLIPY,
      mediaKind: this.resolveResultKind(result),
      url: this.getResultUrl(result),
      sourceUrl: result.itemurl,
      attribution: this.translation.t('common.multimedia.attributionPoweredBy', { platform: 'KLIPY' }),
      title: result.title,
      description: result.content_description,
      contentId: ''
    };
    this.dialogRef.close(multimedia);
  }

  getPreviewUrl(result: GifResult): string {
    return result.media_formats.tinygif?.url || result.media_formats.jpg?.url || result.media_formats.gif.url;
  }

  getResultUrl(result: GifResult): string {
    if (this.resolveResultKind(result) === 'clip') {
      return result.media_formats.mp4?.url || result.media_formats.webm?.url || result.media_formats.gif.url;
    }
    return result.media_formats.gif.url;
  }

  isClipResult(result: GifResult): boolean {
    return this.resolveResultKind(result) === 'clip';
  }

  kindLabel(kind: KlipyMediaKind): string {
    return this.translation.t(`common.klipy.kinds.${kind}`);
  }

  selectedKindLabel(): string {
    return this.kindLabel(this.selectedKind);
  }

  selectKind(kind: KlipyMediaKind): void {
    if (this.selectedKind === kind) {
      return;
    }

    const currentTerm = this.searchControl.value.trim();
    this.selectedKind = kind;
    this.results = [];
    this.nextFeatured = '';
    this.nextSearch = '';
    this.lastSearchTerm = currentTerm;

    if (currentTerm) {
      this.searchGifs();
    } else {
      this.getFeaturedGifs();
    }
  }

  onEnabledChange(enabled: boolean): void {
    const current = this.appService.getAppSettings();
    const updated: AppSettings = { ...current, enableKlipyContent: enabled };
    this.appService.setAppSettings(updated);
    this.showGifProvider = enabled;
    if (this.showGifProvider) {
      this.getFeaturedGifs();
    } else {
      this.results = [];
      this.cdRef.markForCheck();
    }
  }

  private resolveResultKind(result: GifResult): KlipyMediaKind {
    return result.media_kind || this.selectedKind;
  }

  private updateResults(response: GifApiResponse, mode: 'featured' | 'search'): void {
    this.results = response.data.results;
    if (mode === 'featured') {
      this.nextFeatured = response.data.next;
      this.nextSearch = '';
    } else {
      this.nextSearch = response.data.next;
      this.nextFeatured = '';
    }
    this.cdRef.markForCheck();
  }

  private handleGifError(error: unknown): void {
    console.error('Klipy request failed', error);
    this.results = [];
    this.cdRef.markForCheck();
  }

}
