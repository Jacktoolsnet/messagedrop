import { CommonModule } from '@angular/common';
import { Component, ElementRef, Inject, ViewChild } from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { Multimedia } from '../../../interfaces/multimedia';
import { MultimediaType } from '../../../interfaces/multimedia-type';
import { TenorService } from '../../../services/tenor.service';

@Component({
  selector: 'app-multimedia',
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
  templateUrl: './tenor.component.html',
  styleUrl: './tenor.component.css'
})
export class TenorComponent {
  @ViewChild('searchInput') searchInput!: ElementRef<HTMLInputElement>;

  public searchterm: FormControl = new FormControl<string>("");
  public lastSearchterm: string = '';
  public nextFeatured: string = '';
  public nextSearch: string = '';
  public results: any[] = [];

  constructor(
    public dialogRef: MatDialogRef<TenorComponent>,
    private tensorService: TenorService,
    @Inject(MAT_DIALOG_DATA) public data: {}
  ) { }

  ngOnInit(): void {
    this.tensorGetFeaturedGifs();
  }

  tensorGetFeaturedGifs(): void {
    this.tensorService.getFeaturedGifs(this.nextFeatured).subscribe({
      next: tensorResponse => {
        this.results = [];
        this.results.push(...tensorResponse.data.results);
        this.nextFeatured = tensorResponse.data.next;
        this.nextSearch = '';
      },
      error: (err) => { },
      complete: () => { }
    });
  }

  tensorSearchGifs(): void {
    this.tensorService.searchGifs(this.searchterm.value, this.nextSearch).subscribe({
      next: tensorResponse => {
        this.results = [];
        this.results.push(...tensorResponse.data.results);
        this.nextSearch = tensorResponse.data.next;
        this.nextFeatured = '';
      },
      error: (err) => { },
      complete: () => { }
    });
  }

  search(): void {
    // Fokus entfernen → Tastatur schließt sich
    this.searchInput.nativeElement.blur();
    if (this.searchterm.value === '') {
      this.tensorGetFeaturedGifs();
    } else {
      if (this.searchterm.value !== this.lastSearchterm) {
        this.lastSearchterm = this.searchterm.value;
        this.nextSearch = '';
      }
      this.tensorSearchGifs();
    }
  }

  onApplyClick(result: any): void {
    let multimedia: Multimedia = {
      type: MultimediaType.TENOR,
      url: result.media_formats.gif.url,
      sourceUrl: result.itemurl,
      attribution: 'Powered by Tenor',
      title: result.title,
      description: result.content_description,
      contentId: ''
    };
    this.dialogRef.close(multimedia);
  }

}

