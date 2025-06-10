import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatOptionModule } from '@angular/material/core';
import { MAT_DIALOG_DATA, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { Location } from '../../../interfaces/location';
import { NominatimPlace } from '../../../interfaces/nominatim-place';
import { NominatimService } from '../../../services/nominatim.service';

@Component({
  selector: 'app-nominatim-search',
  imports: [
    ReactiveFormsModule,
    CommonModule,
    MatButtonModule,
    MatIcon,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatOptionModule,
    MatDialogContent
  ],
  templateUrl: './nominatim-search.component.html',
  styleUrl: './nominatim-search.component.css'
})
export class NominatimSearchComponent {
  searchterm: FormControl = new FormControl<string>("");

  selectedRadius: number = 0; // z. B. 1000 = 1km
  radiusOptions = [
    { value: 0, label: 'No radius' },
    { value: 1000, label: '1 km' },
    { value: 2000, label: '2 km' },
    { value: 5000, label: '5 km' },
    { value: 10000, label: '10 km' },
    { value: 25000, label: '25 km' },
    { value: 50000, label: '50 km' },
    { value: 100000, label: '100 km' }
  ];

  nominatimPlaces: NominatimPlace[] = [];

  constructor(
    private nominatimService: NominatimService,
    public dialogRef: MatDialogRef<NominatimSearchComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { location: Location }
  ) { }

  ngOnInit(): void {
    this.searchterm.valueChanges.pipe(
      debounceTime(750),
      distinctUntilChanged()
    ).subscribe((keyword: string) => {
      this.search();
    });
  }

  onSelectChange(event: Event): void {
    const selectElement = event.target as HTMLSelectElement;
    selectElement.blur();
  }

  search(): void {
    const term = this.searchterm.value?.trim();
    if (!term) return;

    const limit = 10;
    const radius = this.selectedRadius;

    if (radius === 0) {
      // Weltweite Suche
      this.nominatimService.getAddressBySearchTerm(term, limit).subscribe({
        next: ((results) => {
          this.nominatimPlaces = results;
        }),
        error: ((err) => { })
      });
    } else {
      // Umkreissuche mit Bound
      this.nominatimService.getAddressBySearchTermWithViewboxAndBounded(
        term,
        this.data.location.latitude,
        this.data.location.longitude,
        1,
        limit,
        this.selectedRadius
      ).subscribe({
        next: ((results) => {
          this.nominatimPlaces = results;
        }),
        error: ((err) => { })
      });
    }
  }

  onApplyClick(result: any): void {
    this.dialogRef.close();
  }
}
