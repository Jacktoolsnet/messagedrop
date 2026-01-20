
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { TranslocoPipe } from '@jsverse/transloco';
import { AppSettings } from '../../../interfaces/app-settings';
import { Multimedia } from '../../../interfaces/multimedia';
import { MultimediaType } from '../../../interfaces/multimedia-type';
import { TenorApiResponse, TenorResult } from '../../../interfaces/tenor-response';
import { AppService } from '../../../services/app.service';
import { TenorService } from '../../../services/tenor.service';
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
    TranslocoPipe,
    EnableExternalContentComponent
  ],
  templateUrl: './tenor-search.component.html',
  styleUrl: './tenor-search.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TenorSearchComponent implements OnInit {
  @ViewChild('searchInput') private searchInput?: ElementRef<HTMLInputElement>;

  readonly searchControl = new FormControl('', { nonNullable: true });
  lastSearchTerm = '';
  nextFeatured = '';
  nextSearch = '';
  results: TenorResult[] = [];
  showTenor = false;

  private readonly appService = inject(AppService);
  private readonly dialogRef = inject(MatDialogRef<TenorSearchComponent>);
  private readonly tenorService = inject(TenorService);
  private readonly translation = inject(TranslationHelperService);
  private readonly cdRef = inject(ChangeDetectorRef);
  readonly help = inject(HelpDialogService);

  ngOnInit(): void {
    this.showTenor = this.appService.getAppSettings().enableTenorContent;
    if (this.showTenor) {
      this.tensorGetFeaturedGifs();
    } else {
      this.results = [];
    }
  }

  tensorGetFeaturedGifs(): void {
    this.tenorService.getFeaturedGifs(this.nextFeatured).subscribe({
      next: (tensorResponse: TenorApiResponse) => this.updateResults(tensorResponse, 'featured'),
      error: (error) => this.handleTenorError(error)
    });
  }

  tensorSearchGifs(): void {
    const term = this.searchControl.value.trim();
    if (!term) {
      this.tensorGetFeaturedGifs();
      return;
    }

    this.tenorService.searchGifs(term, this.nextSearch).subscribe({
      next: (tensorResponse: TenorApiResponse) => this.updateResults(tensorResponse, 'search'),
      error: (error) => this.handleTenorError(error)
    });
  }

  search(): void {
    this.searchInput?.nativeElement.blur();
    const currentTerm = this.searchControl.value.trim();
    if (!currentTerm) {
      this.tensorGetFeaturedGifs();
    } else {
      if (currentTerm !== this.lastSearchTerm) {
        this.lastSearchTerm = currentTerm;
        this.nextSearch = '';
      }
      this.tensorSearchGifs();
    }
  }

  onApplyClick(result: TenorResult): void {
    const multimedia: Multimedia = {
      type: MultimediaType.TENOR,
      url: result.media_formats.gif.url,
      sourceUrl: result.itemurl,
      attribution: this.translation.t('common.multimedia.attributionPoweredBy', { platform: 'Tenor' }),
      title: result.title,
      description: result.content_description,
      contentId: ''
    };
    this.dialogRef.close(multimedia);
  }

  onEnabledChange(enabled: boolean): void {
    const current = this.appService.getAppSettings();
    const updated: AppSettings = { ...current, enableTenorContent: enabled };
    this.appService.setAppSettings(updated);
    this.showTenor = enabled;
    if (this.showTenor) {
      this.tensorGetFeaturedGifs();
    } else {
      this.results = [];
      this.cdRef.markForCheck();
    }
  }

  private updateResults(response: TenorApiResponse, mode: 'featured' | 'search'): void {
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

  private handleTenorError(error: unknown): void {
    console.error('Tenor request failed', error);
    this.results = [];
    this.cdRef.markForCheck();
  }

}
