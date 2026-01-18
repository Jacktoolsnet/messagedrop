import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIcon } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { NominatimPlace } from '../../../../../interfaces/nominatim-place';
import { NominatimService } from '../../../../../services/nominatim.service';

@Component({
  selector: 'app-nominatim-result-item',
  standalone: true,
  imports: [MatButtonModule, MatCardModule, MatIcon, TranslocoPipe],
  templateUrl: './nominatim-result-item.component.html',
  styleUrl: './nominatim-result-item.component.css'
})
export class NominatimResultItemComponent {
  @Input({ required: true }) place!: NominatimPlace;
  @Input() showAddButton = true;

  @Output() add = new EventEmitter<NominatimPlace>();
  @Output() flyTo = new EventEmitter<NominatimPlace>();
  @Output() navigate = new EventEmitter<NominatimPlace>();

  private readonly nominatimService = inject(NominatimService);

  getIconForPlace(place: NominatimPlace): string {
    return this.nominatimService.getIconForPlace(place);
  }

  getFormattedAddress(place: NominatimPlace): string {
    return this.nominatimService.getFormattedAddress(place);
  }

  formatDistance(distance: number): string {
    const locale = navigator.language;
    const formattedDistance = new Intl.NumberFormat(locale, {
      maximumFractionDigits: 1,
    }).format(distance >= 1000 ? distance / 1000 : distance);

    return `${formattedDistance} ${distance >= 1000 ? 'km' : 'm'}`;
  }
}
