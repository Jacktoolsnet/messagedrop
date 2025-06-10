import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { TenorService } from '../../../services/tenor.service';

@Component({
  selector: 'app-nominatim-search',
  imports: [
    ReactiveFormsModule,
    CommonModule,
    MatButtonModule,
    MatDialogContent,
    MatIcon,
    FormsModule,
    MatFormFieldModule,
    MatInputModule
  ],
  templateUrl: './nominatim-search.component.html',
  styleUrl: './nominatim-search.component.css'
})
export class NominatimSearchComponent {
  public searchterm: FormControl = new FormControl<string>("");
  public lastSearchterm: string = '';
  public nextFeatured: string = '';
  public nextSearch: string = '';
  public results: any[] = [];

  constructor(
    public dialogRef: MatDialogRef<NominatimSearchComponent>,
    private tensorService: TenorService,
    @Inject(MAT_DIALOG_DATA) public data: {}
  ) { }

  ngOnInit(): void {
    this.searchterm.valueChanges.pipe(
      debounceTime(750),
      distinctUntilChanged()
    ).subscribe((keyword: string) => {
      this.search();
    });
  }

  tensorSearchGifs(): void {
    this.tensorService.searchGifs(this.searchterm.value, this.nextSearch).subscribe({
      next: tensorResponse => {
        this.results = [];
        this.results.push(...tensorResponse.results);
        this.nextSearch = tensorResponse.next;
        this.nextFeatured = '';
      },
      error: (err) => { },
      complete: () => { }
    });
  }

  search(): void {
    if (this.searchterm.value !== this.lastSearchterm) {
      this.lastSearchterm = this.searchterm.value;
      this.nextSearch = '';
    }
    this.tensorSearchGifs();
  }

  onApplyClick(result: any): void {
    this.dialogRef.close();
  }
}
