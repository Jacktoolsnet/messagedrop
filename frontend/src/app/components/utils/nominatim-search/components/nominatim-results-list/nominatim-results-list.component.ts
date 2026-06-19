import { Component, EventEmitter, Input, Output, ChangeDetectionStrategy } from '@angular/core';
import { NominatimPlace } from '../../../../../interfaces/nominatim-place';
import { NominatimResultItemComponent } from '../nominatim-result-item/nominatim-result-item.component';

@Component({
  selector: 'app-nominatim-results-list',
  standalone: true,
  imports: [NominatimResultItemComponent],
  templateUrl: './nominatim-results-list.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './nominatim-results-list.component.css'
})
export class NominatimResultsListComponent {
  @Input() places: NominatimPlace[] = [];
  @Input() showAddButton = true;

  @Output() add = new EventEmitter<NominatimPlace>();
  @Output() apply = new EventEmitter<NominatimPlace>();
  @Output() flyTo = new EventEmitter<NominatimPlace>();
  @Output() navigate = new EventEmitter<NominatimPlace>();
}
