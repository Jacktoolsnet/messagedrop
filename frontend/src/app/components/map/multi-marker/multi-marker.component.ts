
import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogClose, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { TranslocoPipe } from '@jsverse/transloco';
import { LocalDocument } from '../../../interfaces/local-document';
import { LocalImage } from '../../../interfaces/local-image';
import { Message } from '../../../interfaces/message';
import { Note } from '../../../interfaces/note';
import { SecretDrop } from '../../../interfaces/secret-drop';
import { ExperienceResult, ViatorDestinationLookup } from '../../../interfaces/viator';
import { ShortNumberPipe } from '../../../pipes/short-number.pipe';
import { WikipediaArticle } from '../../../interfaces/wikipedia';
import { OverpassCategory, OverpassPoi } from '../../../interfaces/overpass';

const OVERPASS_CATEGORY_BUTTONS: ReadonlyArray<{
    category: OverpassCategory;
    icon: string;
    labelKey: string;
}> = [
    { category: 'accommodation', icon: 'hotel', labelKey: 'common.map.multiMarker.showAccommodation' },
    { category: 'tourism', icon: 'photo_camera', labelKey: 'common.map.multiMarker.showTourism' },
    { category: 'leisure', icon: 'sports_soccer', labelKey: 'common.map.multiMarker.showLeisure' },
    { category: 'food_drink', icon: 'restaurant', labelKey: 'common.map.multiMarker.showFoodDrink' },
    { category: 'amenities', icon: 'wc', labelKey: 'common.map.multiMarker.showAmenities' }
];

@Component({
    selector: 'app-edit-user',
    imports: [
    ShortNumberPipe,
    MatBadgeModule,
    MatFormFieldModule,
    MatInputModule,
    FormsModule,
    MatButtonModule,
    MatDialogContent,
    MatDialogClose,
    MatIcon,
    TranslocoPipe
],
    templateUrl: './multi-marker.component.html',
    changeDetection: ChangeDetectionStrategy.Eager,
    styleUrl: './multi-marker.component.css'
})
export class MultiMarkerComponent {
    readonly dialogRef = inject(MatDialogRef<MultiMarkerComponent>);
    readonly data = inject<{
        messages: Message[];
        notes: Note[];
        images: LocalImage[];
        documents: LocalDocument[];
        experiences: ViatorDestinationLookup[];
        myExperiences: ExperienceResult[];
        secretDrops: SecretDrop[];
        wikipediaArticles: WikipediaArticle[];
        overpassPois: OverpassPoi[];
    }>(MAT_DIALOG_DATA);

    readonly overpassCategoryGroups = OVERPASS_CATEGORY_BUTTONS
        .map((button) => ({
            ...button,
            pois: this.data.overpassPois.filter((poi) => poi.category === button.category)
        }))
        .filter((group) => group.pois.length > 0);
}
