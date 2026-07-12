import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogContent, MatDialogTitle } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { WikipediaArticle, WikipediaAttribution } from '../../interfaces/wikipedia';

@Component({
  selector: 'app-wikipedia-list',
  imports: [MatDialogTitle, MatDialogContent, MatIconModule, TranslocoPipe],
  templateUrl: './wikipedia-list.component.html',
  styleUrl: './wikipedia-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WikipediaListComponent {
  readonly data = inject<{ articles: WikipediaArticle[]; attribution: WikipediaAttribution | null }>(MAT_DIALOG_DATA);
}
