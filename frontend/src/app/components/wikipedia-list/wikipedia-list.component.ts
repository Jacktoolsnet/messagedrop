import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogContent } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialogActions, MatDialogClose, MatDialogRef } from '@angular/material/dialog';
import { TranslocoPipe } from '@jsverse/transloco';
import { WikipediaArticle, WikipediaImageAttribution } from '../../interfaces/wikipedia';
import { DialogHeaderComponent } from '../utils/dialog-header/dialog-header.component';

@Component({
  selector: 'app-wikipedia-list',
  imports: [
    MatDialogContent,
    MatDialogActions,
    MatDialogClose,
    MatIconModule,
    MatButtonModule,
    MatCardModule,
    TranslocoPipe,
    DialogHeaderComponent
  ],
  templateUrl: './wikipedia-list.component.html',
  styleUrl: './wikipedia-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WikipediaListComponent {
  readonly data = inject<{ articles: WikipediaArticle[] }>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<WikipediaListComponent>);

  getHeaderBackgroundImage(article: WikipediaArticle): string {
    const image = article.resolvedAttribution?.image;
    return article.thumbnail && image?.resolved
      ? `url("${article.thumbnail.url}")`
      : 'url("assets/markers/wikipedia-marker.svg")';
  }

  getHeaderBackgroundSize(article: WikipediaArticle): string {
    return article.thumbnail && article.resolvedAttribution?.image?.resolved ? 'cover' : '96px 120px';
  }

  getImageLicenseUrl(attribution: WikipediaImageAttribution): string | undefined {
    return attribution.licenseUrl || attribution.sourceUrl;
  }

  showSeparateImageLink(attribution: WikipediaImageAttribution): boolean {
    return Boolean(
      attribution.sourceUrl
      && attribution.sourceUrl !== this.getImageLicenseUrl(attribution)
    );
  }

  getImageCreator(attribution: WikipediaImageAttribution): string {
    const value = attribution.creator || attribution.credit || '';
    return /^https?:\/\//iu.test(value) ? '' : value;
  }

  openNavigation(article: WikipediaArticle, event: Event): void {
    event.stopPropagation();
    const destination = encodeURIComponent(`${article.latitude},${article.longitude}`);
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${destination}`, '_blank', 'noopener,noreferrer');
  }

  jumpToPin(article: WikipediaArticle, event: Event): void {
    event.stopPropagation();
    this.dialogRef.close({ action: 'jumpToPin', article });
  }

  openWikipedia(article: WikipediaArticle, event: Event): void {
    event.stopPropagation();
    window.open(article.articleUrl, '_blank', 'noopener,noreferrer');
  }
}
